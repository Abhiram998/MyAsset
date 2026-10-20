const express = require('express');
const alertController = require('../controllers/alert.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/stats', alertController.getStats);
router.get('/', alertController.getAlerts);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), alertController.createAlert);
router.patch('/:id/resolve', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), alertController.resolveAlert);

module.exports = router;
