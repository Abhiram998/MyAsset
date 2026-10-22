const express = require('express');
const reportController = require('../controllers/report.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Dashboard KPI stats (accessible by all authenticated roles, scoped internally)
router.get('/stats', reportController.getDashboardStats.bind(reportController));

// Detailed reporting & analytics (Admin, Ops Manager, Supervisor scoped)
router.get('/analytics', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), reportController.getAnalyticsData.bind(reportController));
router.get('/asset-register', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), reportController.getAssetRegister.bind(reportController));
router.get('/maintenance-history', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), reportController.getMaintenanceHistory.bind(reportController));
router.get('/employee-activity', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), reportController.getEmployeeActivity.bind(reportController));
router.get('/zone-utilization', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), reportController.getZoneUtilization.bind(reportController));

module.exports = router;
