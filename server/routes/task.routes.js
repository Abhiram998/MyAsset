const express = require('express');
const taskController = require('../controllers/task.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', taskController.getAllTasks);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR']), taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.patch('/:id/status', taskController.updateTaskStatus);
router.post('/:id/checklists', taskController.addChecklistItem);
router.patch('/checklists/:itemId', taskController.toggleChecklistItem);
router.post('/:id/evidence', taskController.addEvidence);

module.exports = router;
