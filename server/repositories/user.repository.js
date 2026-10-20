const { connect } = require('../db/database');

class UserRepository {
    findByEmail(email) {
        const db = connect();
        const stmt = db.prepare(`
            SELECT u.id, u.organization_id, u.email, u.password_hash, u.role_id, r.name as role_name,
                   e.id as employee_id, e.first_name, e.last_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE u.email = ?
        `);
        return stmt.get(email);
    }

    findById(id) {
        const db = connect();
        const stmt = db.prepare(`
            SELECT u.id, u.organization_id, u.email, u.role_id, r.name as role_name,
                   e.id as employee_id, e.first_name, e.last_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE u.id = ?
        `);
        return stmt.get(id);
    }

    findAll(orgId) {
        const db = connect();
        return db.prepare(`
            SELECT u.id, u.organization_id, u.email, u.role_id, r.name as role_name,
                   e.id as employee_id, e.first_name, e.last_name, e.status as employee_status,
                   u.created_at
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE u.organization_id = ?
            ORDER BY u.created_at DESC
        `).all(orgId);
    }

    create(userData) {
        const db = connect();
        const { organization_id, email, password_hash, role_id } = userData;
        const result = db.prepare(`
            INSERT INTO users (organization_id, email, password_hash, role_id)
            VALUES (?, ?, ?, ?)
        `).run(organization_id, email, password_hash, role_id);
        return result.lastInsertRowid;
    }

    updateRole(userId, orgId, roleId) {
        const db = connect();
        const result = db.prepare(`
            UPDATE users SET role_id = ? WHERE id = ? AND organization_id = ?
        `).run(roleId, userId, orgId);
        return result.changes > 0;
    }

    findAllRoles() {
        const db = connect();
        return db.prepare('SELECT id, name, description FROM roles ORDER BY id ASC').all();
    }
}

module.exports = new UserRepository();
