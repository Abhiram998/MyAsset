const { connect } = require('../db/database');

class GpsController {
    getPositions(req, res) {
        try {
            const db = connect();
            const user = req.user;

            let query = `
                SELECT g.*, e.first_name, e.last_name 
                FROM gps_positions g
                JOIN employees e ON g.employee_id = e.id
                WHERE e.organization_id = ?
            `;
            const params = [user.organization_id];

            if (user.role_name === 'MAINTENANCE STAFF') {
                return res.status(403).json({ error: 'Maintenance Staff cannot access GPS data' });
            }

            if (user.role_name === 'FIELD WORKER') {
                query += ` AND g.employee_id = ?`;
                params.push(user.employee_id);
            } else if (user.role_name === 'SITE / CREW SUPERVISOR') {
                query += ` AND g.employee_id IN (
                    SELECT employee_id FROM employee_zones 
                    WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                )`;
                params.push(user.employee_id);
            }

            query += ` ORDER BY g.recorded_at DESC`;
            const positions = db.prepare(query).all(...params);
            res.json(positions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updatePosition(req, res) {
        try {
            const db = connect();
            const user = req.user;
            const { latitude, longitude, accuracy, status } = req.body;

            // Only employees can update their own GPS position
            if (!user.employee_id) return res.status(403).json({ error: 'Only employees can update GPS' });

            db.prepare(`
                INSERT INTO gps_positions (employee_id, latitude, longitude, accuracy, status)
                VALUES (?, ?, ?, ?, ?)
            `).run(user.employee_id, latitude, longitude, accuracy, status || 'LIVE');

            res.status(201).json({ message: 'GPS position updated' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new GpsController();
