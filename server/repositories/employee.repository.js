const { connect } = require('../db/database');
const bcrypt = require('bcrypt');

class EmployeeRepository {
    async findAll(user, filters = {}) {
        const db = connect();
        
        // Maintenance staff have no access to the employee directory
        if (user.role_name === 'MAINTENANCE STAFF') {
            return [];
        }
        
        let query = `
            SELECT e.*, u.email, r.name as role_name, r.id as role_id,
                   (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.status != 'COMPLETED') as task_count,
                   (SELECT COUNT(*) FROM assignments asn WHERE asn.employee_id = e.id AND asn.returned_at IS NULL) as active_assignment_count,
                   (
                       SELECT GROUP_CONCAT(z.name, ', ')
                       FROM employee_zones ez
                       JOIN zones z ON ez.zone_id = z.id
                       WHERE ez.employee_id = e.id
                   ) as assigned_zones
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE e.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            // Supervisors only see employees in their assigned zones
            query += ` AND e.id IN (
                SELECT employee_id FROM employee_zones 
                WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            )`;
            params.push(user.employee_id);
        } else if (user.role_name === 'FIELD WORKER') {
            // Field workers only see themselves
            query += ` AND e.id = ?`;
            params.push(user.employee_id);
        }

        if (filters.search) {
            query += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR (e.first_name || ' ' || e.last_name) LIKE ? OR u.email LIKE ?)`;
            const term = `%${filters.search}%`;
            params.push(term, term, term, term);
        }
        if (filters.status) {
            query += ` AND e.status = ?`;
            params.push(filters.status);
        }
        if (filters.role) {
            query += ` AND r.name = ?`;
            params.push(filters.role);
        }

        query += ` ORDER BY e.created_at DESC`;
        return await db.prepare(query).all(...params);
    }

    async findById(id, user) {
        const db = connect();
        let query = `
            SELECT e.*, u.email, r.name as role_name, r.id as role_id
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE e.id = ? AND e.organization_id = ?
        `;
        const params = [id, user.organization_id];

        if (user.role_name === 'FIELD WORKER' && Number(id) !== user.employee_id) {
            return null;
        }

        const employee = await db.prepare(query).get(...params);
        if (!employee) return null;

        employee.zones = await db.prepare(`
            SELECT z.id, z.name, l.name as location_name
            FROM employee_zones ez
            JOIN zones z ON ez.zone_id = z.id
            JOIN locations l ON z.location_id = l.id
            WHERE ez.employee_id = ?
        `).all(id);

        return employee;
    }

    async create(employeeData, user) {
        const db = connect();
        const { first_name, last_name, status, email, password, role_id, zone_ids } = employeeData;

        let employeeId;
        const tx = db.transaction(async () => {
            let userId = null;
            if (email && password && role_id) {
                const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
                if (existing) {
                    throw new Error('A user account with this email already exists');
                }
                const password_hash = bcrypt.hashSync(password, 10);
                const userRes = await db.prepare(`
                    INSERT INTO users (organization_id, email, password_hash, role_id)
                    VALUES (?, ?, ?, ?)
                `).run(user.organization_id, email, password_hash, Number(role_id));
                userId = userRes.lastInsertRowid;
            }

            const empRes = await db.prepare(`
                INSERT INTO employees (user_id, organization_id, first_name, last_name, status)
                VALUES (?, ?, ?, ?, ?)
            `).run(userId, user.organization_id, first_name, last_name, status || 'ACTIVE');

            employeeId = empRes.lastInsertRowid;

            if (zone_ids && Array.isArray(zone_ids)) {
                for (const zid of zone_ids) {
                    await db.prepare(`
                        INSERT INTO employee_zones (employee_id, zone_id)
                        VALUES (?, ?)
                        ON CONFLICT DO NOTHING
                    `).run(employeeId, Number(zid));
                }
            }
        });

        await tx();
        return employeeId;
    }

    async update(id, employeeData, user) {
        const db = connect();
        const { first_name, last_name, status, zone_ids } = employeeData;

        const employee = await this.findById(id, user);
        if (!employee) return false;

        const tx = db.transaction(async () => {
            await db.prepare(`
                UPDATE employees
                SET first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    status = COALESCE(?, status)
                WHERE id = ? AND organization_id = ?
            `).run(first_name || null, last_name || null, status || null, id, user.organization_id);

            if (zone_ids && Array.isArray(zone_ids)) {
                await db.prepare('DELETE FROM employee_zones WHERE employee_id = ?').run(id);
                for (const zid of zone_ids) {
                    await db.prepare(`
                        INSERT INTO employee_zones (employee_id, zone_id)
                        VALUES (?, ?)
                    `).run(id, Number(zid));
                }
            }
        });

        await tx();
        return true;
    }
}

module.exports = new EmployeeRepository();
