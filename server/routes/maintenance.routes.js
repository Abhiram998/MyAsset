const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Real KPI stats
router.get('/stats', maintenanceController.getStats);

// Schedules
router.get('/schedules', maintenanceController.getSchedules);
router.post('/schedules', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF']), maintenanceController.createSchedule);
router.patch('/schedules/:id/complete', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF']), maintenanceController.completeSchedule);
router.post('/schedules/:id/complete', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF']), maintenanceController.completeSchedule);

// Requests
router.get('/requests', maintenanceController.getRequests);
router.post('/requests', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF', 'FIELD WORKER']), maintenanceController.createRequest);
router.patch('/requests/:id/status', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'MAINTENANCE STAFF']), maintenanceController.updateRequestStatus);

module.exports = router;
