const express = require('express');
const assetController = require('../controllers/asset.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Types and fields
router.get('/types', assetController.getTypes);
router.get('/types/:typeId/fields', assetController.getCustomFields);

// Asset CRUD & actions
router.get('/', assetController.getAllAssets);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), assetController.createAsset);

// Asset history and details
router.get('/:id/history', assetController.getAssetHistory);
router.get('/:id', assetController.getAssetById);
router.patch('/:id', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF']), assetController.updateAsset);
router.delete('/:id', requireRole(['ADMIN', 'OPERATIONS MANAGER']), assetController.archiveAsset);
router.post('/:id/restore', requireRole(['ADMIN', 'OPERATIONS MANAGER']), assetController.restoreAsset);

module.exports = router;
