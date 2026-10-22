const { connect } = require('../db/database');

class LocationRepository {
    async findAll(user) {
        const db = connect();
        const orgId = typeof user === 'object' && user !== null ? user.organization_id : user;
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
        return await db.prepare(query).all(orgId);
    }

    async findById(id, user) {
        const db = connect();
        const orgId = typeof user === 'object' && user !== null ? user.organization_id : user;
        const location = await db.prepare(`
            SELECT * FROM locations WHERE id = ? AND organization_id = ?
        `).get(id, orgId);

        if (location) {
            location.zones = await db.prepare(`
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

    async findByName(name, organizationId) {
        if (!name || typeof name !== 'string') return null;
        const db = connect();
        return await db.prepare(`
            SELECT * FROM locations 
            WHERE organization_id = ? AND LOWER(name) = LOWER(?)
            LIMIT 1
        `).get(organizationId, name.trim());
    }

    async create(locationData) {
        const db = connect();
        const { organization_id, name, address } = locationData;
        const result = await db.prepare(`
            INSERT INTO locations (organization_id, name, address)
            VALUES (?, ?, ?)
        `).run(organization_id, name.trim(), address ? address.trim() : null);
        return result.lastInsertRowid;
    }
}

module.exports = new LocationRepository();
