const express = require('express');
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/stats', reportController.getDashboardStats.bind(reportController));
router.get('/analytics', reportController.getAnalyticsData.bind(reportController));
router.get('/asset-register', reportController.getAssetRegister.bind(reportController));
router.get('/maintenance-history', reportController.getMaintenanceHistory.bind(reportController));
router.get('/employee-activity', reportController.getEmployeeActivity.bind(reportController));
router.get('/zone-utilization', reportController.getZoneUtilization.bind(reportController));

module.exports = router;
