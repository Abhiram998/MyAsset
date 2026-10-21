const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const { token, user } = await authService.login(email, password);

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
            });

            res.json({ message: 'Login successful', user });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({ error: 'Invalid email or password' });
        }
    }

    async register(req, res) {
        try {
            const { companyName, firstName, lastName, email, password } = req.body;

            if (!companyName || !companyName.trim()) {
                return res.status(400).json({ error: 'Company name is required' });
            }
            if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
                return res.status(400).json({ error: 'First name and last name are required' });
            }
            if (!email || !email.trim()) {
                return res.status(400).json({ error: 'Work email is required' });
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: 'Please provide a valid work email address' });
            }
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            const { token, user } = await authService.register({
                companyName: companyName.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password
            });

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000 // 8 hours
            });

            res.status(201).json({ message: 'Company registered successfully', user });
        } catch (error) {
            console.error('Registration error:', error);
            if (error.message.includes('already exists') || error.code === '23505' || error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'An account with this email already exists' });
            }
            res.status(400).json({ error: error.message || 'Registration failed' });
        }
    }

    logout(req, res) {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({ message: 'Logged out successfully' });
    }

    async getSession(req, res) {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const freshUser = await userRepository.findById(req.user.id);
        if (!freshUser) {
            return res.status(401).json({ error: 'User no longer exists' });
        }
        res.json({
            user: {
                id: freshUser.id,
                email: freshUser.email,
                role: freshUser.role_name,
                role_name: freshUser.role_name,
                organization_id: freshUser.organization_id,
                employee_id: freshUser.employee_id,
                first_name: freshUser.first_name || '',
                last_name: freshUser.last_name || ''
            }
        });
    }
}

module.exports = new AuthController();
