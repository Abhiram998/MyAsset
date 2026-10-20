const zoneRepository = require('../repositories/zone.repository');

class ZoneController {
    getAllZones(req, res) {
        try {
            const zones = zoneRepository.findAll(req.user);
            res.json(zones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getZoneById(req, res) {
        try {
            const zone = zoneRepository.findById(req.params.id, req.user);
            if (!zone) {
                return res.status(404).json({ error: 'Zone not found' });
            }
            res.json(zone);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createZone(req, res) {
        try {
            const { location_id, name, description } = req.body;
            if (!location_id || !name) {
                return res.status(400).json({ error: 'Location ID and zone name are required' });
            }

            const id = zoneRepository.create({
                organization_id: req.user.organization_id,
                location_id: Number(location_id),
                name,
                description
            });

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_ZONE', null, null, id, `Created zone ${name}`);

            res.status(201).json({ id, message: 'Zone created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ZoneController();
