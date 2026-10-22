const { connect } = require('../db/database');

class AssetRepository {
    async getTypes(orgId) {
        const db = connect();
        return await db.prepare('SELECT * FROM asset_types WHERE organization_id = ? ORDER BY name ASC').all(orgId);
    }

    async createType(orgId, name) {
        const db = connect();
        return await db.prepare('INSERT INTO asset_types (organization_id, name) VALUES (?, ?)').run(orgId, name);
    }

    async getCustomFields(typeId) {
        const db = connect();
        return await db.prepare('SELECT * FROM asset_custom_fields WHERE asset_type_id = ? ORDER BY id ASC').all(typeId);
    }

    async findAll(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT a.*, at.name as type_name, z.name as zone_name, l.name as location_name,
                   (
                       SELECT e.first_name || ' ' || e.last_name
                       FROM assignments asn
                       JOIN employees e ON asn.employee_id = e.id
                       WHERE asn.asset_id = a.id AND asn.returned_at IS NULL
                       ORDER BY asn.assigned_at DESC LIMIT 1
                   ) as assigned_to_name,
                   (
                       SELECT asn.employee_id
                       FROM assignments asn
                       WHERE asn.asset_id = a.id AND asn.returned_at IS NULL
                       ORDER BY asn.assigned_at DESC LIMIT 1
                   ) as assigned_to_id,
                   (
                       SELECT act.created_at
                       FROM activity act
                       WHERE act.asset_id = a.id
                       ORDER BY act.created_at DESC LIMIT 1
                   ) as last_activity_at
            FROM assets a
            JOIN asset_types at ON a.asset_type_id = at.id
            LEFT JOIN zones z ON a.zone_id = z.id
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        // Do not return archived assets unless explicitly asked
        if (filters.status === 'ARCHIVED') {
            query += ` AND a.status = 'ARCHIVED'`;
        } else if (filters.includeArchived) {
            // include all
        } else {
            query += ` AND (a.status != 'ARCHIVED' OR a.status IS NULL)`;
        }

        // Role-based visibility
        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND (
                a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                OR a.id IN (
                    SELECT asset_id FROM assignments 
                    WHERE employee_id IN (
                        SELECT employee_id FROM employee_zones 
                        WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                    ) AND returned_at IS NULL
                )
            )`;
            params.push(user.employee_id, user.employee_id);
        } else if (user.role_name === 'MAINTENANCE STAFF') {
            query += ` AND (
                a.id IN (SELECT asset_id FROM maintenance_schedules)
                OR a.id IN (SELECT asset_id FROM maintenance_requests)
                OR a.status = 'IN_MAINTENANCE'
            )`;
        } else if (user.role_name === 'FIELD WORKER') {
            // Field Worker sees only explicitly assigned assets or assigned tasks
            query += ` AND (
                a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL)
                OR a.id IN (SELECT asset_id FROM tasks WHERE assignee_id = ? AND status != 'COMPLETED')
            )`;
            params.push(user.employee_id, user.employee_id);
        }

        // Additional filters
        if (filters.status && filters.status !== 'all' && filters.status !== 'ARCHIVED') {
            query += ` AND a.status = ?`;
            params.push(filters.status);
        }
        if (filters.type_id) {
            query += ` AND a.asset_type_id = ?`;
            params.push(filters.type_id);
        }
        if (filters.zone_id) {
            query += ` AND a.zone_id = ?`;
            params.push(filters.zone_id);
        }
        if (filters.search) {
            query += ` AND (a.name LIKE ? OR a.tag_id LIKE ? OR a.serial_number LIKE ?)`;
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY a.created_at DESC`;
        return await db.prepare(query).all(...params);
    }

    async findById(id, user) {
        const db = connect();
        let query = `
            SELECT a.*, at.name as type_name, z.name as zone_name, l.name as location_name,
                   (
                       SELECT e.first_name || ' ' || e.last_name
                       FROM assignments asn
                       JOIN employees e ON asn.employee_id = e.id
                       WHERE asn.asset_id = a.id AND asn.returned_at IS NULL
                       ORDER BY asn.assigned_at DESC LIMIT 1
                   ) as assigned_to_name,
                   (
                       SELECT asn.employee_id
                       FROM assignments asn
                       WHERE asn.asset_id = a.id AND asn.returned_at IS NULL
                       ORDER BY asn.assigned_at DESC LIMIT 1
                   ) as assigned_to_id
            FROM assets a
            JOIN asset_types at ON a.asset_type_id = at.id
            LEFT JOIN zones z ON a.zone_id = z.id
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE a.id = ? AND a.organization_id = ?
        `;
        const params = [id, user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND (
                a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                OR a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL)
            )`;
            params.push(user.employee_id, user.employee_id);
        } else if (user.role_name === 'MAINTENANCE STAFF') {
            query += ` AND (
                a.id IN (SELECT asset_id FROM maintenance_schedules)
                OR a.id IN (SELECT asset_id FROM maintenance_requests)
                OR a.status = 'IN_MAINTENANCE'
            )`;
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND (
                a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL)
                OR a.id IN (SELECT asset_id FROM tasks WHERE assignee_id = ? AND status != 'COMPLETED')
            )`;
            params.push(user.employee_id, user.employee_id);
        }

        const asset = await db.prepare(query).get(...params);

        if (asset) {
            asset.customValues = await db.prepare(`
                SELECT acf.id as field_id, acf.name, acf.field_type, acv.value 
                FROM asset_custom_values acv
                JOIN asset_custom_fields acf ON acv.field_id = acf.id
                WHERE acv.asset_id = ?
            `).all(asset.id);
        }

        return asset;
    }

    async create(assetData) {
        const db = connect();
        const { organization_id, asset_type_id, name, tag_id, zone_id, condition, serial_number, notes, custom_values } = assetData;
        
        let assetId;
        const createTx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO assets (organization_id, asset_type_id, name, tag_id, status, zone_id, condition, serial_number, notes)
                VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, ?)
            `).run(organization_id, asset_type_id, name, tag_id, zone_id || null, condition || 'GOOD', serial_number || null, notes || null);
            
            assetId = result.lastInsertRowid;

            if (custom_values && Array.isArray(custom_values)) {
                for (const cv of custom_values) {
                    if (cv.field_id && cv.value !== undefined) {
                        await db.prepare(`
                            INSERT INTO asset_custom_values (asset_id, field_id, value)
                            VALUES (?, ?, ?)
                        `).run(assetId, cv.field_id, String(cv.value));
                    }
                }
            }
        });
        
        await createTx();
        return assetId;
    }

    async update(id, assetData, user) {
        const db = connect();
        const { name, asset_type_id, tag_id, status, zone_id, condition, serial_number, notes, custom_values } = assetData;
        
        const existing = await this.findById(id, user);
        if (!existing) return false;

        const updateTx = db.transaction(async () => {
            await db.prepare(`
                UPDATE assets
                SET name = COALESCE(?, name),
                    asset_type_id = COALESCE(?, asset_type_id),
                    tag_id = COALESCE(?, tag_id),
                    status = COALESCE(?, status),
                    zone_id = ?,
                    condition = COALESCE(?, condition),
                    serial_number = COALESCE(?, serial_number),
                    notes = COALESCE(?, notes)
                WHERE id = ? AND organization_id = ?
            `).run(
                name !== undefined ? name : null,
                asset_type_id !== undefined ? asset_type_id : null,
                tag_id !== undefined ? tag_id : null,
                status !== undefined ? status : null,
                zone_id !== undefined ? zone_id : existing.zone_id,
                condition !== undefined ? condition : null,
                serial_number !== undefined ? serial_number : null,
                notes !== undefined ? notes : null,
                id,
                user.organization_id
            );

            if (custom_values && Array.isArray(custom_values)) {
                for (const cv of custom_values) {
                    if (cv.field_id && cv.value !== undefined) {
                        await db.prepare(`
                            INSERT INTO asset_custom_values (asset_id, field_id, value)
                            VALUES (?, ?, ?)
                            ON CONFLICT(asset_id, field_id) DO UPDATE SET value = excluded.value
                        `).run(id, cv.field_id, String(cv.value));
                    }
                }
            }
        });

        await updateTx();
        return true;
    }

    async archive(id, user) {
        const db = connect();
        const result = await db.prepare(`
            UPDATE assets 
            SET status = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP
            WHERE id = ? AND organization_id = ?
        `).run(id, user.organization_id);
        return result.changes > 0;
    }

    async restore(id, user) {
        const db = connect();
        const result = await db.prepare(`
            UPDATE assets 
            SET status = 'AVAILABLE', archived_at = NULL
            WHERE id = ? AND organization_id = ?
        `).run(id, user.organization_id);
        return result.changes > 0;
    }

    async getAssetHistory(id, user) {
        const db = connect();
        const asset = await this.findById(id, user);
        if (!asset) return null;

        const assignments = await db.prepare(`
            SELECT asn.*, e.first_name || ' ' || e.last_name as employee_name,
                   u.email as assigned_by_email,
                   z.name as zone_name
            FROM assignments asn
            JOIN employees e ON asn.employee_id = e.id
            JOIN users u ON asn.assigned_by_id = u.id
            LEFT JOIN assets a ON asn.asset_id = a.id
            LEFT JOIN zones z ON a.zone_id = z.id
            WHERE asn.asset_id = ?
            ORDER BY asn.assigned_at DESC
        `).all(id);

        const maintenance = await db.prepare(`
            SELECT mr.*, e.first_name || ' ' || e.last_name as technician_name
            FROM maintenance_records mr
            JOIN employees e ON mr.staff_id = e.id
            WHERE mr.asset_id = ?
            ORDER BY mr.completed_at DESC
        `).all(id);

        const schedules = await db.prepare(`
            SELECT ms.*
            FROM maintenance_schedules ms
            WHERE ms.asset_id = ?
            ORDER BY ms.due_date ASC
        `).all(id);

        const activity = await db.prepare(`
            SELECT act.*, e.first_name || ' ' || e.last_name as employee_name, z.name as zone_name
            FROM activity act
            LEFT JOIN employees e ON act.employee_id = e.id
            LEFT JOIN zones z ON act.zone_id = z.id
            WHERE act.asset_id = ?
            ORDER BY act.created_at DESC
        `).all(id);

        const alerts = await db.prepare(`
            SELECT * FROM alerts
            WHERE related_entity_id = ? AND organization_id = ?
            ORDER BY created_at DESC
        `).all(id, user.organization_id);

        return {
            asset,
            assignments,
            maintenance,
            schedules,
            activity,
            alerts
        };
    }
}

module.exports = new AssetRepository();
