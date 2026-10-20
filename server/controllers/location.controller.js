const locationRepository = require('../repositories/location.repository');

class LocationController {
    getAllLocations(req, res) {
        try {
            const locations = locationRepository.findAll(req.user);
            res.json(locations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getLocationById(req, res) {
        try {
            const location = locationRepository.findById(req.params.id, req.user);
            if (!location) {
                return res.status(404).json({ error: 'Location not found' });
            }
            res.json(location);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createLocation(req, res) {
        try {
            const { name, address } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Location name is required' });
            }

            const id = locationRepository.create({
                organization_id: req.user.organization_id,
                name,
                address
            });

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_LOCATION', null, null, null, `Created location ${name}`);

            res.status(201).json({ id, message: 'Location created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LocationController();
