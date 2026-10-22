const gpsRepository = require('../repositories/gps.repository');

class GpsController {
    async getPositions(req, res) {
        try {
            const user = req.user;

            if (user.role_name === 'MAINTENANCE STAFF') {
                return res.status(403).json({ error: 'Maintenance Staff cannot access GPS data' });
            }

            const positions = await gpsRepository.getPositions(user);
            res.json(positions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updatePosition(req, res) {
        try {
            const user = req.user;
            const { latitude, longitude, accuracy, status } = req.body;

            // Only employees can update their own GPS position
            if (!user.employee_id) return res.status(403).json({ error: 'Only employees can update GPS' });

            if (latitude === undefined || longitude === undefined) {
                return res.status(400).json({ error: 'Latitude and longitude are required' });
            }

            await gpsRepository.insertPosition(user.employee_id, latitude, longitude, accuracy, status);
            res.status(201).json({ message: 'GPS position updated' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new GpsController();
