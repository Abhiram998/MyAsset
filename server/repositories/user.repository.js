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

    async createOrganizationWithAdmin({ companyName, firstName, lastName, email, password_hash }) {
        const db = connect();
        const execute = async () => {
            // 1. Insert organization
            const orgResult = await db.prepare('INSERT INTO organizations (name) VALUES (?)').run(companyName);
            const organizationId = orgResult.lastInsertRowid;

            // 2. Insert company settings
            await db.prepare(`
                INSERT INTO settings (organization_id, company_name)
                VALUES (?, ?)
            `).run(organizationId, companyName);

            // 3. Find ADMIN role
            const adminRole = await db.prepare("SELECT id FROM roles WHERE name = 'ADMIN'").get();
            const roleId = adminRole ? adminRole.id : 1;

            // 4. Insert user
            const userResult = await db.prepare(`
                INSERT INTO users (organization_id, email, password_hash, role_id)
                VALUES (?, ?, ?, ?)
            `).run(organizationId, email, password_hash, roleId);
            const userId = userResult.lastInsertRowid;

            // 5. Insert employee profile for primary administrator
            const empResult = await db.prepare(`
                INSERT INTO employees (user_id, organization_id, first_name, last_name, status)
                VALUES (?, ?, ?, ?, 'ACTIVE')
            `).run(userId, organizationId, firstName, lastName);
            const employeeId = empResult.lastInsertRowid;

            // 6. Log system activity
            await db.prepare(`
                INSERT INTO activity (organization_id, employee_id, action, details)
                VALUES (?, ?, 'REGISTERED_ORGANIZATION', ?)
            `).run(organizationId, employeeId, `Registered company "${companyName}" with primary admin ${email}`);

            return {
                organizationId,
                userId,
                employeeId
            };
        };

        const tx = db.transaction(execute);
        return await tx();
    }
}

module.exports = new UserRepository();
