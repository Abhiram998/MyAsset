const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// List roles (accessible by Admin & Operations Manager)
router.get('/roles', requireRole(['ADMIN', 'OPERATIONS MANAGER']), userController.getAllRoles);

// User administration (Listing accessible by Admin & Operations Manager; mutation Admin only)
router.get('/', requireRole(['ADMIN', 'OPERATIONS MANAGER']), userController.getAllUsers);
router.post('/', requireRole(['ADMIN']), userController.createUser);
router.patch('/:id/role', requireRole(['ADMIN']), userController.updateUserRole);

module.exports = router;
