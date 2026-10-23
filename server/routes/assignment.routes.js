const express = require('express');
const assignmentController = require('../controllers/assignment.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Real KPI stats
router.get('/stats', assignmentController.getStats);

// List assignments (scoped by role)
router.get('/', assignmentController.getAllAssignments);

// Checkout asset (Admin, Ops, Supervisor)
router.post('/checkout', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), assignmentController.checkout);

// Return asset (Admin, Ops, Supervisor, Field Worker returning own asset)
router.post('/:id/return', assignmentController.returnAsset);

// Get assignment by ID (scoped by role & worker ownership)
router.get('/:id', assignmentController.getAssignmentById);

module.exports = router;
