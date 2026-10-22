const { connect } = require('../db/database');

class RfidRepository {
    async findAll(orgId) {
        const db = connect();
        return await db.prepare(`
            SELECT r.*, l.name as location_name
            FROM rfid_devices r
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.organization_id = ?
            ORDER BY r.id ASC
            LIMIT 100
        `).all(orgId);
    }

    async create(orgId, name, locationId) {
        const db = connect();
        const result = await db.prepare(`
            INSERT INTO rfid_devices (organization_id, name, location_id, status)
            VALUES (?, ?, ?, 'PLANNED')
        `).run(orgId, name, locationId ? Number(locationId) : null);
        return result.lastInsertRowid;
    }
}

module.exports = new RfidRepository();
