const express = require('express');
const employeeController = require('../controllers/employee.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', employeeController.getAllEmployees);
router.get('/:id', employeeController.getEmployeeById);
router.post('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), employeeController.createEmployee);
router.patch('/:id', requireRole(['ADMIN', 'OPERATIONS MANAGER']), employeeController.updateEmployee);

module.exports = router;
