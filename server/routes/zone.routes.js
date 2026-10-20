const express = require('express');
const zoneController = require('../controllers/zone.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', zoneController.getAllZones);
router.get('/:id', zoneController.getZoneById);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), zoneController.createZone);

module.exports = router;
