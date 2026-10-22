const zoneRepository = require('../repositories/zone.repository');
const locationRepository = require('../repositories/location.repository');

class ZoneController {
    async getAllZones(req, res) {
        try {
            let zones = await zoneRepository.findAll(req.user);
            if ((!zones || zones.length === 0) && req.user && req.user.organization_id) {
                let locs = await locationRepository.findAll(req.user);
                let locId;
                if (!locs || locs.length === 0) {
                    locId = await locationRepository.create({
                        organization_id: req.user.organization_id,
                        name: 'Primary Operating Depot',
                        address: 'Headquarters / Main Yard'
                    });
                } else {
                    locId = locs[0].id;
                }
                if (locId) {
                    await zoneRepository.create({
                        location_id: locId,
                        name: 'Main Equipment Yard',
                        description: 'Primary staging area for all fleet units'
                    });
                    zones = await zoneRepository.findAll(req.user);
                }
            }
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
