const { connect } = require('../db/database');

class ZoneRepository {
    findAll(user) {
        const db = connect();
        
        let query = `
            SELECT z.*, l.name as location_name, l.address as location_address,
                   (SELECT COUNT(*) FROM assets WHERE zone_id = z.id AND (status != 'ARCHIVED' OR status IS NULL)) as asset_count,
                   (SELECT COUNT(*) FROM employee_zones WHERE zone_id = z.id) as employee_count,
                   (SELECT COUNT(*) FROM alerts WHERE related_entity_id = z.id AND is_resolved = 0) as alert_count
            FROM zones z
            JOIN locations l ON z.location_id = l.id
            WHERE l.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR' || user.role_name === 'FIELD WORKER') {
            query += ` AND z.id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY z.name ASC`;
        return db.prepare(query).all(...params);
    }

    findById(id, user) {
        const db = connect();
        const query = `
            SELECT z.*, l.name as location_name, l.address as location_address
            FROM zones z
            JOIN locations l ON z.location_id = l.id
            WHERE z.id = ? AND l.organization_id = ?
        `;
        const zone = db.prepare(query).get(id, user.organization_id);
        if (!zone) return null;

        zone.assets = db.prepare(`
            SELECT a.id, a.name, a.tag_id, a.status, at.name as type_name
            FROM assets a
            JOIN asset_types at ON a.asset_type_id = at.id
            WHERE a.zone_id = ? AND (a.status != 'ARCHIVED' OR a.status IS NULL)
        `).all(id);

        zone.crew = db.prepare(`
            SELECT e.id, e.first_name, e.last_name, e.status, r.name as role_name
            FROM employee_zones ez
            JOIN employees e ON ez.employee_id = e.id
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE ez.zone_id = ?
        `).all(id);

        return zone;
    }

    create(zoneData) {
        const db = connect();
        const { location_id, name, description } = zoneData;
        const result = db.prepare(`
            INSERT INTO zones (location_id, name, description)
            VALUES (?, ?, ?)
        `).run(location_id, name, description || null);
        
        return result.lastInsertRowid;
    }
}

module.exports = new ZoneRepository();
