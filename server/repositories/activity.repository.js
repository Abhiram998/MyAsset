const { connect } = require('../db/database');

class ActivityRepository {
    getActivities(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT ac.*, 
                   e.first_name, e.last_name,
                   e.first_name || ' ' || e.last_name as employee_name,
                   a.name as asset_name, a.tag_id as asset_tag,
                   z.name as zone_name
            FROM activity ac
            LEFT JOIN employees e ON ac.employee_id = e.id
            LEFT JOIN assets a ON ac.asset_id = a.id
            LEFT JOIN zones z ON ac.zone_id = z.id
            WHERE ac.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND (
                ac.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?) 
                OR ac.employee_id IN (
                    SELECT employee_id FROM employee_zones 
                    WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                )
            )`;
            params.push(user.employee_id, user.employee_id);
        } else if (user.role_name === 'FIELD WORKER' || user.role_name === 'MAINTENANCE STAFF') {
            query += ` AND ac.employee_id = ?`;
            params.push(user.employee_id);
        }

        if (filters.action && filters.action !== 'all') {
            query += ` AND ac.action = ?`;
            params.push(filters.action);
        }
        if (filters.employee_id && filters.employee_id !== 'all') {
            query += ` AND ac.employee_id = ?`;
            params.push(Number(filters.employee_id));
        }
        if (filters.date_range === 'today') {
            query += ` AND date(ac.created_at) = date('now')`;
        } else if (filters.date_range === '7days') {
            query += ` AND ac.created_at >= datetime('now', '-7 days')`;
        } else if (filters.date_range === '30days') {
            query += ` AND ac.created_at >= datetime('now', '-30 days')`;
        }

        if (filters.search) {
            query += ` AND (ac.details LIKE ? OR a.name LIKE ? OR a.tag_id LIKE ? OR (e.first_name || ' ' || e.last_name) LIKE ?)`;
            const term = `%${filters.search}%`;
            params.push(term, term, term, term);
        }

        query += ` ORDER BY ac.created_at DESC LIMIT 100`;
        return db.prepare(query).all(...params);
    }

    logActivity(activityData) {
        const db = connect();
        const { organization_id, employee_id, action, asset_id, task_id, zone_id, details } = activityData;
        const result = db.prepare(`
            INSERT INTO activity (organization_id, employee_id, action, asset_id, task_id, zone_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(organization_id, employee_id || null, action, asset_id || null, task_id || null, zone_id || null, details || null);
        
        return result.lastInsertRowid;
    }
}

module.exports = new ActivityRepository();
