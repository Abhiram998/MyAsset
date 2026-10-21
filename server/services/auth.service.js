const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');

const JWT_SECRET = process.env.COOKIE_SECRET || 'fallback_secret';
const EXPIRES_IN = '8h';

class AuthService {
    async login(email, password) {
        const user = await userRepository.findByEmail(email);
        
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            throw new Error('Invalid email or password');
        }

        const tokenPayload = {
            id: user.id,
            organization_id: user.organization_id,
            role_name: user.role_name,
            employee_id: user.employee_id,
            first_name: user.first_name || '',
            last_name: user.last_name || ''
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: EXPIRES_IN });
        
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role_name,
                role_name: user.role_name,
                organization_id: user.organization_id,
                employee_id: user.employee_id,
                first_name: user.first_name || '',
                last_name: user.last_name || ''
            }
        };
    }
}

module.exports = new AuthService();
