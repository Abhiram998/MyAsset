const { connect } = require('../db/database');

class AssignmentRepository {
    findAll(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT asn.*, 
                   a.name as asset_name, a.tag_id as asset_tag, at.name as type_name, a.condition as asset_condition,
                   e.first_name || ' ' || e.last_name as employee_name,
                   z.name as zone_name,
                   u.email as assigned_by_email,
                   CASE 
                       WHEN asn.returned_at IS NOT NULL THEN 'RETURNED'
                       WHEN asn.expected_return IS NOT NULL AND asn.expected_return < CURRENT_TIMESTAMP THEN 'OVERDUE'
                       ELSE 'ACTIVE'
                   END as calculated_status
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            JOIN asset_types at ON a.asset_type_id = at.id
            JOIN employees e ON asn.employee_id = e.id
            JOIN users u ON asn.assigned_by_id = u.id
            LEFT JOIN zones z ON a.zone_id = z.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        // Role Scoping
        if (user.role_name === 'FIELD WORKER') {
            query += ` AND asn.employee_id = ?`;
            params.push(user.employee_id);
        } else if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND asn.employee_id IN (
                SELECT employee_id FROM employee_zones 
                WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            )`;
            params.push(user.employee_id);
        }

        // Filters
        if (filters.filter === 'checked-out' || filters.activeOnly) {
            query += ` AND asn.returned_at IS NULL`;
        }
        if (filters.asset_id) {
            query += ` AND asn.asset_id = ?`;
            params.push(filters.asset_id);
        }
        if (filters.employee_id) {
            query += ` AND asn.employee_id = ?`;
            params.push(filters.employee_id);
        }
        if (filters.search) {
            query += ` AND (a.name LIKE ? OR a.tag_id LIKE ? OR (e.first_name || ' ' || e.last_name) LIKE ?)`;
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY asn.assigned_at DESC`;
        return db.prepare(query).all(...params);
    }

    findById(id, user) {
        const db = connect();
        const query = `
            SELECT asn.*, a.organization_id, a.name as asset_name, a.tag_id as asset_tag
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE asn.id = ? AND a.organization_id = ?
        `;
        return db.prepare(query).get(id, user.organization_id);
    }

    checkout(data, user) {
        const db = connect();
        const { asset_id, employee_id, expected_return, notes } = data;

        // Verify asset availability
        const asset = db.prepare(`SELECT * FROM assets WHERE id = ? AND organization_id = ?`).get(asset_id, user.organization_id);
        if (!asset) {
            throw new Error('Asset not found');
        }
        if (asset.status !== 'AVAILABLE') {
            throw new Error(`Asset cannot be checked out because it is currently ${asset.status}`);
        }

        // Verify employee
        const employee = db.prepare(`SELECT * FROM employees WHERE id = ? AND organization_id = ?`).get(employee_id, user.organization_id);
        if (!employee) {
            throw new Error('Employee not found');
        }

        // Authorization check for supervisor
        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            const isAuthorized = db.prepare(`
                SELECT 1 FROM employee_zones 
                WHERE employee_id = ? 
                AND zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(employee_id, user.employee_id);
            if (!isAuthorized) {
                throw new Error('You can only assign equipment to crew members in your assigned sites/zones');
            }
        }

        let assignmentId;
        const tx = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO assignments (asset_id, employee_id, assigned_by_id, expected_return, notes)
                VALUES (?, ?, ?, ?, ?)
            `).run(asset_id, employee_id, user.id, expected_return || null, notes || null);
            
            assignmentId = result.lastInsertRowid;

            db.prepare(`UPDATE assets SET status = 'ASSIGNED' WHERE id = ?`).run(asset_id);

            db.prepare(`
                INSERT INTO activity (organization_id, employee_id, action, asset_id, zone_id, details)
                VALUES (?, ?, 'CHECKED_OUT_ASSET', ?, ?, ?)
            `).run(
                user.organization_id,
                employee_id,
                asset_id,
                asset.zone_id,
                `Checked out to ${employee.first_name} ${employee.last_name}${expected_return ? ` (Expected: ${expected_return})` : ''}`
            );
        });

        tx();
        return assignmentId;
    }

    returnAsset(assignmentId, user) {
        const db = connect();
        const assignment = this.findById(assignmentId, user);
        if (!assignment) {
            throw new Error('Assignment record not found');
        }
        if (assignment.returned_at) {
            throw new Error('Asset has already been returned');
        }

        // Scope check for Field Worker
        if (user.role_name === 'FIELD WORKER' && assignment.employee_id !== user.employee_id) {
            throw new Error('You can only return assets checked out to yourself');
        }

        const employee = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(assignment.employee_id);
        const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get(assignment.asset_id);

        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE assignments 
                SET returned_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(assignmentId);

            db.prepare(`
                UPDATE assets 
                SET status = 'AVAILABLE' 
                WHERE id = ?
            `).run(assignment.asset_id);

            db.prepare(`
                INSERT INTO activity (organization_id, employee_id, action, asset_id, zone_id, details)
                VALUES (?, ?, 'RETURNED_ASSET', ?, ?, ?)
            `).run(
                user.organization_id,
                assignment.employee_id,
                assignment.asset_id,
                asset ? asset.zone_id : null,
                `Returned by ${employee ? `${employee.first_name} ${employee.last_name}` : 'employee'}`
            );
        });

        tx();
        return true;
    }

    getStats(user) {
        const db = connect();
        const orgId = user.organization_id;

        const totalCheckedOut = db.prepare(`
            SELECT COUNT(*) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? AND asn.returned_at IS NULL
        `).get(orgId).count;

        const overdue = db.prepare(`
            SELECT COUNT(*) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? 
              AND asn.returned_at IS NULL 
              AND asn.expected_return IS NOT NULL 
              AND asn.expected_return < CURRENT_TIMESTAMP
        `).get(orgId).count;

        const dueToday = db.prepare(`
            SELECT COUNT(*) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? 
              AND asn.returned_at IS NULL 
              AND asn.expected_return IS NOT NULL 
              AND date(asn.expected_return) = date('now')
        `).get(orgId).count;

        const returnedToday = db.prepare(`
            SELECT COUNT(*) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? 
              AND asn.returned_at IS NOT NULL 
              AND date(asn.returned_at) = date('now')
        `).get(orgId).count;

        const siteCount = db.prepare(`
            SELECT COUNT(DISTINCT a.zone_id) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? AND asn.returned_at IS NULL AND a.zone_id IS NOT NULL
        `).get(orgId).count;

        return {
            checkedOut: totalCheckedOut,
            overdue,
            dueToday,
            returnedToday,
            siteCount
        };
    }
}

module.exports = new AssignmentRepository();
