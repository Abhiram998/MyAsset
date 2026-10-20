const { connect } = require('../db/database');

class MaintenanceRepository {
    getSchedules(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT ms.*, a.name as asset_name, a.tag_id as asset_tag, at.name as type_name,
                   z.name as zone_name
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            JOIN asset_types at ON a.asset_type_id = at.id
            LEFT JOIN zones z ON a.zone_id = z.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR' || user.role_name === 'FIELD WORKER') {
            query += ` AND (
                a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                OR a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL)
            )`;
            params.push(user.employee_id, user.employee_id);
        }

        if (filters.status) {
            query += ` AND ms.status = ?`;
            params.push(filters.status);
        }
        if (filters.asset_id) {
            query += ` AND ms.asset_id = ?`;
            params.push(filters.asset_id);
        }

        query += ` ORDER BY ms.due_date ASC`;
        return db.prepare(query).all(...params);
    }

    createSchedule(data, user) {
        const db = connect();
        const { asset_id, title, due_date, priority, notes } = data;
        const result = db.prepare(`
            INSERT INTO maintenance_schedules (asset_id, title, due_date, priority, notes, status)
            VALUES (?, ?, ?, ?, ?, 'UPCOMING')
        `).run(asset_id, title, due_date, priority || 'MEDIUM', notes || null);
        return result.lastInsertRowid;
    }

    completeSchedule(id, notes, staffId, user) {
        const db = connect();
        const schedule = db.prepare(`
            SELECT ms.*, a.organization_id 
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE ms.id = ? AND a.organization_id = ?
        `).get(id, user.organization_id);

        if (!schedule) throw new Error('Schedule not found');

        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE maintenance_schedules 
                SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(id);

            db.prepare(`
                INSERT INTO maintenance_records (asset_id, staff_id, schedule_id, notes)
                VALUES (?, ?, ?, ?)
            `).run(schedule.asset_id, staffId || user.employee_id || 1, id, notes || 'Routine scheduled maintenance completed');
        });

        tx();
        return true;
    }

    getRequests(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT mr.*, a.name as asset_name, a.tag_id as asset_tag, at.name as type_name,
                   e1.first_name || ' ' || e1.last_name as reporter_name,
                   e2.first_name || ' ' || e2.last_name as assignee_name
            FROM maintenance_requests mr
            JOIN assets a ON mr.asset_id = a.id
            JOIN asset_types at ON a.asset_type_id = at.id
            LEFT JOIN employees e1 ON mr.reporter_id = e1.id
            LEFT JOIN employees e2 ON mr.assigned_staff_id = e2.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND (mr.reporter_id = ? OR a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL))`;
            params.push(user.employee_id, user.employee_id);
        } else if (user.role_name === 'MAINTENANCE STAFF') {
            // Maintenance staff see requests assigned to them OR unassigned requests
            query += ` AND (mr.assigned_staff_id = ? OR mr.assigned_staff_id IS NULL)`;
            params.push(user.employee_id);
        }

        if (filters.status) {
            query += ` AND mr.status = ?`;
            params.push(filters.status);
        }
        if (filters.asset_id) {
            query += ` AND mr.asset_id = ?`;
            params.push(filters.asset_id);
        }

        query += ` ORDER BY mr.created_at DESC`;
        return db.prepare(query).all(...params);
    }

    createRequest(requestData, user) {
        const db = connect();
        const { asset_id, reporter_id, description, priority } = requestData;

        let requestId;
        const tx = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO maintenance_requests (asset_id, reporter_id, description, priority, status)
                VALUES (?, ?, ?, ?, 'OPEN')
            `).run(asset_id, reporter_id, description, priority || 'MEDIUM');
            
            requestId = result.lastInsertRowid;

            // Mark asset as IN_MAINTENANCE
            db.prepare(`UPDATE assets SET status = 'IN_MAINTENANCE' WHERE id = ?`).run(asset_id);
        });

        tx();
        return requestId;
    }

    getRequestById(id) {
        const db = connect();
        return db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(id);
    }

    updateRequestStatus(id, status, notes, staff_id) {
        const db = connect();
        const request = this.getRequestById(id);
        if (!request) return;

        const tx = db.transaction(() => {
            let query = `UPDATE maintenance_requests SET status = ?, assigned_staff_id = COALESCE(assigned_staff_id, ?)`;
            if (status === 'COMPLETED') query += `, completed_at = CURRENT_TIMESTAMP, resolution_notes = ?`;
            query += ` WHERE id = ?`;
            
            if (status === 'COMPLETED') {
                db.prepare(query).run(status, staff_id, notes || 'Resolved', id);
            } else {
                db.prepare(query).run(status, staff_id, id);
            }

            if (status === 'COMPLETED') {
                // Add a record in maintenance_records
                db.prepare(`
                    INSERT INTO maintenance_records (asset_id, staff_id, request_id, notes)
                    VALUES (?, ?, ?, ?)
                `).run(request.asset_id, staff_id || 1, id, notes || 'Completed service repair');

                // Check if any other open requests or schedules for this asset
                const remaining = db.prepare(`
                    SELECT COUNT(*) as count FROM maintenance_requests 
                    WHERE asset_id = ? AND status != 'COMPLETED' AND id != ?
                `).get(request.asset_id, id).count;

                if (remaining === 0) {
                    db.prepare(`UPDATE assets SET status = 'AVAILABLE' WHERE id = ? AND status = 'IN_MAINTENANCE'`).run(request.asset_id);
                }
            }
        });

        tx();
    }

    getStats(user) {
        const db = connect();
        const orgId = user.organization_id;

        const dueToday = db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' AND date(ms.due_date) = date('now')
        `).get(orgId).count;

        const upcoming = db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' 
              AND ms.due_date > datetime('now') AND ms.due_date <= datetime('now', '+7 days')
        `).get(orgId).count;

        const overdue = db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' AND ms.due_date < datetime('now')
        `).get(orgId).count;

        const inMaintenance = db.prepare(`
            SELECT COUNT(*) as count
            FROM assets
            WHERE organization_id = ? AND status = 'IN_MAINTENANCE'
        `).get(orgId).count;

        const assetCounts = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('AVAILABLE', 'ASSIGNED') THEN 1 ELSE 0 END) as healthy
            FROM assets
            WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)
        `).get(orgId);

        const fleetHealth = assetCounts.total > 0
            ? Math.round((assetCounts.healthy / assetCounts.total) * 1000) / 10
            : 100.0;

        return {
            dueToday,
            upcoming,
            overdue,
            inMaintenance,
            fleetHealth: fleetHealth + '%'
        };
    }
}

module.exports = new MaintenanceRepository();
