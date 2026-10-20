const express = require('express');
const activityController = require('../controllers/activity.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', activityController.getActivities);
router.post('/', activityController.logActivity);

module.exports = router;
