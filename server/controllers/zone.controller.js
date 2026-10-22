const zoneRepository = require('../repositories/zone.repository');
const locationRepository = require('../repositories/location.repository');

const { connect } = require('../db/database');

class ZoneController {
    async getAllZones(req, res) {
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
            const zones = await zoneRepository.findAll(req.user);
            res.json(zones || []);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getZoneById(req, res) {
        try {
            const zone = await zoneRepository.findById(req.params.id, req.user);
            if (!zone) {
                return res.status(404).json({ error: 'Zone not found' });
            }
            res.json(zone);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createZone(req, res) {
        try {
            const { location_id, location_name, facility_name, name, description, address } = req.body;
            
            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Zone name is required' });
            }

            let resolvedLocationId = location_id !== undefined && location_id !== null && location_id !== '' 
                ? Number(location_id) 
                : null;
            const facilityName = (location_name || facility_name || '').trim();

            if (resolvedLocationId) {
                if (isNaN(resolvedLocationId)) {
                    return res.status(400).json({ error: 'Valid Location ID or facility name is required' });
                }
                // Enforce tenant isolation: ensure location belongs to caller's organization
                const location = await locationRepository.findById(resolvedLocationId, req.user);
                if (!location) {
                    return res.status(404).json({ error: 'Location not found or access denied' });
                }
            } else if (facilityName) {
                // Find existing location in tenant or create one
                let location = await locationRepository.findByName(facilityName, req.user.organization_id);
                if (!location) {
                    resolvedLocationId = await locationRepository.create({
                        organization_id: req.user.organization_id,
                        name: facilityName,
                        address: address ? address.trim() : null
                    });
                } else {
                    resolvedLocationId = location.id;
                }
            } else {
                return res.status(400).json({ error: 'Location ID and zone name are required' });
            }

            const id = await zoneRepository.create({
                organization_id: req.user.organization_id,
                location_id: resolvedLocationId,
                name: name.trim(),
                description: description ? description.trim() : null
            });

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_ZONE', null, null, id, `Created zone ${name.trim()}`);

            res.status(201).json({ id, location_id: resolvedLocationId, message: 'Zone created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ZoneController();
