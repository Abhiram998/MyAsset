const locationRepository = require('../repositories/location.repository');

class LocationController {
    async getAllLocations(req, res) {
        try {
            const locations = await locationRepository.findAll(req.user);
            res.json(locations || []);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getLocationById(req, res) {
        try {
            const location = await locationRepository.findById(req.params.id, req.user);
            if (!location) {
                return res.status(404).json({ error: 'Location not found' });
            }
            res.json(location);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createLocation(req, res) {
        try {
            const { name, address } = req.body;
            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Location name is required' });
            }

            const id = await locationRepository.create({
                organization_id: req.user.organization_id,
                name: name.trim(),
                address: address ? address.trim() : null
            });

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_LOCATION', null, null, null, `Created location ${name.trim()}`);

            res.status(201).json({ id, message: 'Location created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LocationController();
