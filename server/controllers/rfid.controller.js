const { connect } = require('../db/database');

class RfidController {
    getDevices(req, res) {
        try {
            const db = connect();
            const devices = db.prepare(`
                SELECT r.*, l.name as location_name
                FROM rfid_devices r
                LEFT JOIN locations l ON r.location_id = l.id
                WHERE r.organization_id = ?
                ORDER BY r.id ASC
            `).all(req.user.organization_id);
            res.json(devices);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createDevice(req, res) {
        try {
            const { name, location_id } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Device name is required' });
            }

            const db = connect();
            // Planned RFID configuration without pretending hardware is connected
            const result = db.prepare(`
                INSERT INTO rfid_devices (organization_id, name, location_id, status)
                VALUES (?, ?, ?, 'PLANNED')
            `).run(req.user.organization_id, name, location_id ? Number(location_id) : null);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'REGISTERED_RFID_GATEWAY', null, null, null, `Configured planned RFID device: ${name}`);

            res.status(201).json({ id: result.lastInsertRowid, message: 'RFID device configured (Planned state)' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new RfidController();
