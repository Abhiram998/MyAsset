const { connect } = require('../db/database');

class AlertRepository {
    async getAlerts(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT al.*, u.email as resolved_by_email,
                   a.name as asset_name, a.tag_id as asset_tag,
                   z.name as zone_name
            FROM alerts al
            LEFT JOIN users u ON al.resolved_by_id = u.id
            LEFT JOIN assets a ON al.related_entity_id = a.id
            LEFT JOIN zones z ON a.zone_id = z.id
            WHERE al.organization_id = ?
        `;
        const params = [user.organization_id];

        if (filters.status === 'unresolved') {
            query += ` AND al.is_resolved = 0`;
        } else if (filters.status === 'resolved') {
            query += ` AND al.is_resolved = 1`;
        }

        if (filters.severity) {
            query += ` AND al.severity = ?`;
            params.push(filters.severity);
        }

        query += ` ORDER BY al.created_at DESC LIMIT 100`;
        return await db.prepare(query).all(...params);
    }

    async createAlert(alertData) {
        const db = connect();
        const { organization_id, type, severity, message, related_entity_id } = alertData;

        // Deduplication: prevent duplicate unresolved alerts for the same entity and type
        if (related_entity_id) {
            const existing = await db.prepare(`
                SELECT id FROM alerts 
                WHERE organization_id = ? AND type = ? AND related_entity_id = ? AND is_resolved = 0
            `).get(organization_id, type, related_entity_id);
            if (existing) {
                return { id: existing.id, isDuplicate: true };
            }
        }

        const result = await db.prepare(`
            INSERT INTO alerts (organization_id, type, severity, message, related_entity_id, is_resolved)
            VALUES (?, ?, ?, ?, ?, FALSE)
        `).run(organization_id, type, severity || 'MEDIUM', message, related_entity_id || null);
        return { id: result.lastInsertRowid, isDuplicate: false };
    }

    async getStats(user) {
        const db = connect();
        const orgId = user.organization_id;

        const totalRow = await db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE organization_id = ?`).get(orgId);
        const total = totalRow?.count || 0;

        const unresolvedRow = await db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE organization_id = ? AND is_resolved = FALSE`).get(orgId);
        const unresolved = unresolvedRow?.count || 0;

        const resolvedRow = await db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE organization_id = ? AND is_resolved = TRUE`).get(orgId);
        const resolved = resolvedRow?.count || 0;

        const highSeverityRow = await db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE organization_id = ? AND is_resolved = FALSE AND severity = 'HIGH'`).get(orgId);
        const highSeverity = highSeverityRow?.count || 0;

        return {
            total,
            unresolved,
            resolved,
            highSeverity
        };
    }

    async resolveAlert(id, userId, orgId) {
        const db = connect();
        const result = await db.prepare(`
            UPDATE alerts 
            SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP, resolved_by_id = ?
            WHERE id = ? AND organization_id = ?
        `).run(userId, id, orgId);
        return result.changes > 0;
    }
}

module.exports = new AlertRepository();
