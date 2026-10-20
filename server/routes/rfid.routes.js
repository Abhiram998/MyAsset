const express = require('express');
const rfidController = require('../controllers/rfid.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', rfidController.getDevices);
router.post('/', requireRole(['ADMIN']), rfidController.createDevice);

module.exports = router;
