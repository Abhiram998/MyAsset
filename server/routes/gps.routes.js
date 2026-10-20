const express = require('express');
const gpsController = require('../controllers/gps.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', gpsController.getPositions);
router.post('/', gpsController.updatePosition);

module.exports = router;
