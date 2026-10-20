const { connect } = require('../db/database');

class LocationRepository {
    findAll(user) {
        const db = connect();
        let query = `
            SELECT l.*,
                   (SELECT COUNT(*) FROM zones z WHERE z.location_id = l.id) as zone_count,
                   (
                       SELECT COUNT(*) 
                       FROM assets a 
                       JOIN zones z ON a.zone_id = z.id 
                       WHERE z.location_id = l.id AND (a.status != 'ARCHIVED' OR a.status IS NULL)
                   ) as asset_count,
                   (
                       SELECT COUNT(DISTINCT ez.employee_id)
                       FROM employee_zones ez
                       JOIN zones z ON ez.zone_id = z.id
                       WHERE z.location_id = l.id
                   ) as employee_count
            FROM locations l
            WHERE l.organization_id = ?
            ORDER BY l.name ASC
        `;
        return db.prepare(query).all(user.organization_id);
    }

    findById(id, user) {
        const db = connect();
        const location = db.prepare(`
            SELECT * FROM locations WHERE id = ? AND organization_id = ?
        `).get(id, user.organization_id);

        if (location) {
            location.zones = db.prepare(`
                SELECT z.*,
                       (SELECT COUNT(*) FROM assets WHERE zone_id = z.id AND (status != 'ARCHIVED' OR status IS NULL)) as asset_count,
                       (SELECT COUNT(*) FROM employee_zones WHERE zone_id = z.id) as employee_count
                FROM zones z
                WHERE z.location_id = ?
                ORDER BY z.name ASC
            `).all(id);
        }

        return location;
    }

    create(locationData) {
        const db = connect();
        const { organization_id, name, address } = locationData;
        const result = db.prepare(`
            INSERT INTO locations (organization_id, name, address)
            VALUES (?, ?, ?)
        `).run(organization_id, name, address || null);
        return result.lastInsertRowid;
    }
}

module.exports = new LocationRepository();
