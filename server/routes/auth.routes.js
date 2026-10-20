const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dedicated rate limiter for authentication to protect against brute-force credential stuffing
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/session', authenticate, authController.getSession);

module.exports = router;
