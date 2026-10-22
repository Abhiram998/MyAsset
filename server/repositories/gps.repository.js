const { connect } = require('../db/database');

class GpsRepository {
    async getPositions(user) {
        const db = connect();
        let query = `
            SELECT g.*, e.first_name, e.last_name 
            FROM gps_positions g
            JOIN employees e ON g.employee_id = e.id
            WHERE e.organization_id = ?
        `;
        const params = [user.organization_id];

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

        query += ` ORDER BY g.recorded_at DESC LIMIT 100`;
        return await db.prepare(query).all(...params);
    }

    async insertPosition(employeeId, latitude, longitude, accuracy, status = 'LIVE') {
        const db = connect();
        const result = await db.prepare(`
            INSERT INTO gps_positions (employee_id, latitude, longitude, accuracy, status)
            VALUES (?, ?, ?, ?, ?)
        `).run(employeeId, latitude, longitude, accuracy || null, status);
        return result.lastInsertRowid;
    }
}

module.exports = new GpsRepository();
