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

    logout(req, res) {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.json({ message: 'Logged out successfully' });
    }

    getSession(req, res) {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const freshUser = userRepository.findById(req.user.id);
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
