const locationRepository = require('../repositories/location.repository');
const zoneRepository = require('../repositories/zone.repository');

const { connect } = require('../db/database');

class LocationController {
    async getAllLocations(req, res) {
        try {
            if (req.user && req.user.organization_id) {
                const db = connect();
                const orgLoc = await db.prepare('SELECT id FROM locations WHERE organization_id = ? LIMIT 1').get(req.user.organization_id);
                if (!orgLoc) {
                    const locId = await locationRepository.create({
                        organization_id: req.user.organization_id,
                        name: 'Primary Operating Depot',
                        address: 'Headquarters / Main Yard'
                    });
                    if (locId) {
                        const zoneId = await zoneRepository.create({
                            location_id: locId,
                            name: 'Main Equipment Yard',
                            description: 'Primary staging area for all fleet units'
                        });
                        if (req.user.employee_id) {
                            await db.prepare('INSERT INTO employee_zones (employee_id, zone_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                                .run(req.user.employee_id, zoneId);
                        }
                    }
                }
            }
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
