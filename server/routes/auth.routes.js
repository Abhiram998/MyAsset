const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/session', authenticate, authController.getSession);

module.exports = router;
