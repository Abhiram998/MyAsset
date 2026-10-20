const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.COOKIE_SECRET || 'fallback_secret';

function authenticate(req, res, next) {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains id, organization_id, role_name
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }
}

function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
        }
        next();
    };
}

module.exports = {
    authenticate,
    requireRole
};
