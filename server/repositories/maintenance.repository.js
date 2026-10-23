const { connect } = require('../db/database');

class MaintenanceRepository {
    async getSchedules(user, filters = {}) {
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

        if (user.role_name === 'FIELD WORKER') {
            query += ` AND a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ?)`;
            params.push(user.employee_id);
        } else if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND (
                a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                OR a.id IN (
                    SELECT asset_id FROM assignments 
                    WHERE employee_id IN (
                        SELECT employee_id FROM employee_zones 
                        WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                    ) AND returned_at IS NULL
                )
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
        return await db.prepare(query).all(...params);
    }

    async createSchedule(data, user) {
        const db = connect();
        const { asset_id, title, due_date, priority, notes } = data;
        const result = await db.prepare(`
            INSERT INTO maintenance_schedules (asset_id, title, due_date, priority, notes, status)
            VALUES (?, ?, ?, ?, ?, 'UPCOMING')
        `).run(asset_id, title, due_date, priority || 'MEDIUM', notes || null);
        return result.lastInsertRowid;
    }

    async completeSchedule(id, notes, staffId, user) {
        const db = connect();
        const schedule = await db.prepare(`
            SELECT ms.*, a.organization_id 
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE ms.id = ? AND a.organization_id = ?
        `).get(id, user.organization_id);

        if (!schedule) throw new Error('Schedule not found');

        const tx = db.transaction(async () => {
            await db.prepare(`
                UPDATE maintenance_schedules 
                SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(id);

            await db.prepare(`
                INSERT INTO maintenance_records (asset_id, staff_id, schedule_id, notes)
                VALUES (?, ?, ?, ?)
            `).run(schedule.asset_id, staffId || user.employee_id || 1, id, notes || 'Routine scheduled maintenance completed');
        });

        await tx();
        return true;
    }

    async getRequests(user, filters = {}) {
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
        return await db.prepare(query).all(...params);
    }

    async createRequest(requestData, user) {
        const db = connect();
        const { asset_id, reporter_id, description, priority } = requestData;

        if (user.role_name === 'FIELD WORKER') {
            const isAssigned = await db.prepare(`
                SELECT 1 FROM assignments 
                WHERE asset_id = ? AND employee_id = ? AND returned_at IS NULL
            `).get(asset_id, user.employee_id);
            if (!isAssigned) {
                throw new Error('You can only report maintenance for equipment currently assigned to you');
            }
        }

        const effectiveReporterId = user.role_name === 'FIELD WORKER' ? user.employee_id : (reporter_id || user.employee_id);

        let requestId;
        const tx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO maintenance_requests (asset_id, reporter_id, description, priority, status)
                VALUES (?, ?, ?, ?, 'OPEN')
            `).run(asset_id, effectiveReporterId, description, priority || 'MEDIUM');
            
            requestId = result.lastInsertRowid;

            // Mark asset as IN_MAINTENANCE
            await db.prepare(`UPDATE assets SET status = 'IN_MAINTENANCE' WHERE id = ?`).run(asset_id);
        });

        await tx();
        return requestId;
    }

    async getRequestById(id) {
        const db = connect();
        return await db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(id);
    }

    async updateRequestStatus(id, status, notes, staff_id) {
        const db = connect();
        const request = await this.getRequestById(id);
        if (!request) return;

        const tx = db.transaction(async () => {
            let query = `UPDATE maintenance_requests SET status = ?, assigned_staff_id = COALESCE(assigned_staff_id, ?)`;
            if (status === 'COMPLETED') query += `, completed_at = CURRENT_TIMESTAMP, resolution_notes = ?`;
            query += ` WHERE id = ?`;
            
            if (status === 'COMPLETED') {
                await db.prepare(query).run(status, staff_id, notes || 'Resolved', id);
            } else {
                await db.prepare(query).run(status, staff_id, id);
            }

            if (status === 'COMPLETED') {
                await db.prepare(`
                    INSERT INTO maintenance_records (asset_id, staff_id, request_id, notes)
                    VALUES (?, ?, ?, ?)
                `).run(request.asset_id, staff_id || 1, id, notes || 'Completed service repair');

                const remainingRow = await db.prepare(`
                    SELECT COUNT(*) as count FROM maintenance_requests 
                    WHERE asset_id = ? AND status != 'COMPLETED' AND id != ?
                `).get(request.asset_id, id);
                const remaining = remainingRow?.count || 0;

                if (remaining === 0) {
                    await db.prepare(`UPDATE assets SET status = 'AVAILABLE' WHERE id = ? AND status = 'IN_MAINTENANCE'`).run(request.asset_id);
                }
            }
        });

        await tx();
    }

    async getStats(user) {
        const db = connect();
        const orgId = user.organization_id;

        const dueTodayRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' AND date(ms.due_date) = date('now')
        `).get(orgId);
        const dueToday = dueTodayRow?.count || 0;

        const upcomingRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' 
              AND ms.due_date > datetime('now') AND ms.due_date <= datetime('now', '+7 days')
        `).get(orgId);
        const upcoming = upcomingRow?.count || 0;

        const overdueRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM maintenance_schedules ms
            JOIN assets a ON ms.asset_id = a.id
            WHERE a.organization_id = ? AND ms.status != 'COMPLETED' AND ms.due_date < datetime('now')
        `).get(orgId);
        const overdue = overdueRow?.count || 0;

        const inMaintenanceRow = await db.prepare(`
            SELECT COUNT(*) as count
            FROM assets
            WHERE organization_id = ? AND status = 'IN_MAINTENANCE'
        `).get(orgId);
        const inMaintenance = inMaintenanceRow?.count || 0;

        const assetCounts = await db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('AVAILABLE', 'ASSIGNED') THEN 1 ELSE 0 END) as healthy
            FROM assets
            WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)
        `).get(orgId);

        const fleetHealth = (assetCounts && assetCounts.total > 0)
            ? Math.round((assetCounts.healthy / assetCounts.total) * 1000) / 10
            : 100.0;

        return {
            dueToday,
            due_today: dueToday,
            upcoming,
            overdue,
            inMaintenance,
            in_maintenance: inMaintenance,
            fleetHealth: fleetHealth + '%',
            fleet_health: fleetHealth
        };
    }
}

module.exports = new MaintenanceRepository();
