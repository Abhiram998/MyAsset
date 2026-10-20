const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), settingsController.updateSettings);

module.exports = router;
