const { connect } = require('../db/database');

class ZoneRepository {
    async findAll(user) {
        const db = connect();
        const orgId = typeof user === 'object' && user !== null ? user.organization_id : user;
        
        let query = `
            SELECT z.*, 
                   COALESCE(l.name, 'Primary Facility') as location_name, 
                   COALESCE(l.address, 'Main Address') as location_address,
                   (SELECT COUNT(*) FROM assets WHERE zone_id = z.id AND (status != 'ARCHIVED' OR status IS NULL)) as asset_count,
                   (SELECT COUNT(*) FROM employee_zones WHERE zone_id = z.id) as employee_count,
                   (SELECT COUNT(*) FROM alerts WHERE related_entity_id = z.id AND is_resolved = 0) as alert_count
            FROM zones z
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE l.organization_id = ?
        `;
        const params = [orgId];

        if (user && (user.role_name === 'SITE / CREW SUPERVISOR' || user.role_name === 'FIELD WORKER')) {
            query += ` AND z.id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY z.name ASC`;
        return await db.prepare(query).all(...params);
    }

    async findById(id, user) {
        const db = connect();
        const orgId = typeof user === 'object' && user !== null ? user.organization_id : user;
        const query = `
            SELECT z.*, 
                   COALESCE(l.name, 'Primary Facility') as location_name, 
                   COALESCE(l.address, 'Main Address') as location_address
            FROM zones z
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE z.id = ? AND l.organization_id = ?
        `;
        const zone = await db.prepare(query).get(id, orgId);
        if (!zone) return null;

        if (user && (user.role_name === 'SITE / CREW SUPERVISOR' || user.role_name === 'FIELD WORKER')) {
            const hasAccess = await db.prepare(`SELECT 1 FROM employee_zones WHERE employee_id = ? AND zone_id = ?`).get(user.employee_id, id);
            if (!hasAccess) return null;
        }

        zone.assets = await db.prepare(`
            SELECT a.id, a.name, a.tag_id, a.status, at.name as type_name
            FROM assets a
            JOIN asset_types at ON a.asset_type_id = at.id
            WHERE a.zone_id = ? AND (a.status != 'ARCHIVED' OR a.status IS NULL)
        `).all(id);

        zone.crew = await db.prepare(`
            SELECT e.id, e.first_name, e.last_name, e.status, r.name as role_name
            FROM employee_zones ez
            JOIN employees e ON ez.employee_id = e.id
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE ez.zone_id = ?
        `).all(id);

        return zone;
    }

    async create(zoneData) {
        const db = connect();
        const { location_id, name, description } = zoneData;
        const result = await db.prepare(`
            INSERT INTO zones (location_id, name, description)
            VALUES (?, ?, ?)
        `).run(location_id, name.trim(), description ? description.trim() : null);
        
        return result.lastInsertRowid;
    }
}

module.exports = new ZoneRepository();
