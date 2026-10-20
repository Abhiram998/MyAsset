const assetService = require('../services/asset.service');

class AssetController {
    getTypes(req, res) {
        try {
            const types = assetService.getTypes(req.user.organization_id);
            res.json(types);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getCustomFields(req, res) {
        try {
            const typeId = req.params.typeId;
            const fields = assetService.getCustomFields(typeId);
            res.json(fields);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getAllAssets(req, res) {
        try {
            const filters = {
                status: req.query.status,
                type_id: req.query.type_id ? Number(req.query.type_id) : undefined,
                zone_id: req.query.zone_id ? Number(req.query.zone_id) : undefined,
                search: req.query.search,
                includeArchived: req.query.includeArchived === 'true'
            };
            const assets = assetService.getAllAssets(req.user, filters);
            res.json(assets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getAssetById(req, res) {
        try {
            const asset = assetService.getAssetById(req.params.id, req.user);
            if (!asset) {
                return res.status(404).json({ error: 'Asset not found or access denied' });
            }
            res.json(asset);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getAssetHistory(req, res) {
        try {
            const history = assetService.getAssetHistory(req.params.id, req.user);
            if (!history) {
                return res.status(404).json({ error: 'Asset not found or access denied' });
            }
            res.json(history);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createAsset(req, res) {
        try {
            const { name, asset_type_id, tag_id } = req.body;
            if (!name || !asset_type_id) {
                return res.status(400).json({ error: 'Name and asset type are required' });
            }

            const assetData = {
                organization_id: req.user.organization_id,
                ...req.body
            };
            // Generate tag_id if not provided
            if (!assetData.tag_id) {
                assetData.tag_id = 'AST-' + Math.floor(1000 + Math.random() * 9000);
            }

            const id = assetService.createAsset(assetData);
            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_ASSET', id, null, assetData.zone_id, `Registered asset ${name}`);
            res.status(201).json({ id, tag_id: assetData.tag_id, message: 'Asset created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updateAsset(req, res) {
        try {
            const id = req.params.id;
            const updated = assetService.updateAsset(id, req.body, req.user);
            if (!updated) {
                return res.status(404).json({ error: 'Asset not found or update denied' });
            }
            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'UPDATED_ASSET', id, null, req.body.zone_id, `Updated asset ID ${id}`);
            res.json({ message: 'Asset updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    archiveAsset(req, res) {
        try {
            const id = req.params.id;
            const archived = assetService.archiveAsset(id, req.user);
            if (!archived) {
                return res.status(404).json({ error: 'Asset not found' });
            }
            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'ARCHIVED_ASSET', id, null, null, `Archived asset ID ${id}`);
            res.json({ message: 'Asset archived successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    restoreAsset(req, res) {
        try {
            const id = req.params.id;
            const restored = assetService.restoreAsset(id, req.user);
            if (!restored) {
                return res.status(404).json({ error: 'Asset not found' });
            }
            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'RESTORED_ASSET', id, null, null, `Restored asset ID ${id}`);
            res.json({ message: 'Asset restored successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AssetController();
