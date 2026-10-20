const express = require('express');
const locationController = require('../controllers/location.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', locationController.getAllLocations);
router.get('/:id', locationController.getLocationById);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), locationController.createLocation);

module.exports = router;
