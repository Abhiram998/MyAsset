const { connect } = require('../db/database');

class ReportRepository {
    async getAssetRegister(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT a.tag_id, a.name, at.name as type, z.name as zone, l.name as location, a.status, a.condition, a.created_at
            FROM assets a
            JOIN asset_types at ON a.asset_type_id = at.id
            LEFT JOIN zones z ON a.zone_id = z.id
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        } else if (user.role_name === 'MAINTENANCE STAFF') {
            query += ` AND (a.id IN (SELECT asset_id FROM maintenance_requests) OR a.id IN (SELECT asset_id FROM maintenance_schedules) OR a.status = 'IN_MAINTENANCE')`;
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ? AND returned_at IS NULL)`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY a.created_at DESC LIMIT 500`;
        return await db.prepare(query).all(...params);
    }

    async getMaintenanceHistory(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT mr.id, a.name as asset, a.tag_id as asset_tag,
                   e.first_name || ' ' || e.last_name as technician, 
                   mr.notes, mr.completed_at
            FROM maintenance_records mr
            JOIN assets a ON mr.asset_id = a.id
            JOIN employees e ON mr.staff_id = e.id
            WHERE a.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND a.id IN (SELECT asset_id FROM assignments WHERE employee_id = ?)`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY mr.completed_at DESC LIMIT 500`;
        return await db.prepare(query).all(...params);
    }

    async getEmployeeActivity(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT e.first_name || ' ' || e.last_name as employee, ac.action, ac.details, ac.created_at, z.name as location
            FROM activity ac
            JOIN employees e ON ac.employee_id = e.id
            LEFT JOIN zones z ON ac.zone_id = z.id
            WHERE ac.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND ac.employee_id IN (SELECT employee_id FROM employee_zones WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?))`;
            params.push(user.employee_id);
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND ac.employee_id = ?`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY ac.created_at DESC LIMIT 500`;
        return await db.prepare(query).all(...params);
    }

    async getZoneUtilization(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT z.name as zone, l.name as location,
                   COUNT(a.id) as total_assets,
                   SUM(CASE WHEN a.status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned_assets
            FROM zones z
            LEFT JOIN assets a ON z.id = a.zone_id AND (a.status != 'ARCHIVED' OR a.status IS NULL)
            JOIN locations l ON z.location_id = l.id
            WHERE l.organization_id = ?
            GROUP BY z.id, z.name, l.name
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND z.id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND z.id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        }

        query += ` ORDER BY total_assets DESC LIMIT 200`;
        return await db.prepare(query).all(...params);
    }

    async getDashboardStats(user) {
        const db = connect();
        const orgId = user.organization_id;

        if (user.role_name === 'FIELD WORKER') {
            const empId = user.employee_id;
            const currentAssetsRow = await db.prepare(`
                SELECT COUNT(DISTINCT a.id) as count 
                FROM assets a
                JOIN assignments asn ON a.id = asn.asset_id
                WHERE a.organization_id = ? AND asn.employee_id = ? AND asn.returned_at IS NULL
            `).get(orgId, empId);
            const totalAssets = currentAssetsRow?.count || 0;

            const activeAssignmentsRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM assignments asn
                JOIN assets a ON asn.asset_id = a.id
                WHERE a.organization_id = ? AND asn.employee_id = ? AND asn.returned_at IS NULL
            `).get(orgId, empId);
            const activeAssignments = activeAssignmentsRow?.count || 0;

            const activeTasksRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM tasks 
                WHERE organization_id = ? AND assignee_id = ? AND status != 'COMPLETED'
            `).get(orgId, empId);
            const activeTasks = activeTasksRow?.count || 0;

            return {
                totalAssets,
                total_assets: totalAssets,
                availableAssets: 0,
                available_assets: 0,
                activeAssignments,
                active_assignments: activeAssignments,
                utilizationRate: totalAssets > 0 ? '100.0%' : '0.0%',
                fleet_utilization: totalAssets > 0 ? '100.0' : '0.0',
                inMaintenance: 0,
                in_maintenance: 0,
                activeTasks,
                active_tasks: activeTasks,
                alerts: 0,
                security_alerts: 0,
                maintenance_cost: 0
            };
        }

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            const empId = user.employee_id;
            const totalAssetsRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM assets a
                WHERE a.organization_id = ? AND (a.status != 'ARCHIVED' OR a.status IS NULL)
                  AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(orgId, empId);
            const totalAssets = totalAssetsRow?.count || 0;

            const activeAssignmentsRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM assignments asn
                JOIN assets a ON asn.asset_id = a.id
                WHERE a.organization_id = ? AND asn.returned_at IS NULL
                  AND asn.employee_id IN (
                      SELECT employee_id FROM employee_zones 
                      WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                  )
            `).get(orgId, empId);
            const activeAssignments = activeAssignmentsRow?.count || 0;

            const inMaintenanceRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM assets a
                WHERE a.organization_id = ? AND a.status = 'IN_MAINTENANCE'
                  AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(orgId, empId);
            const inMaintenance = inMaintenanceRow?.count || 0;

            const activeTasksRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM tasks 
                WHERE organization_id = ? AND status != 'COMPLETED'
                  AND zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(orgId, empId);
            const activeTasks = activeTasksRow?.count || 0;

            const alertsRow = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM alerts 
                WHERE is_resolved = FALSE AND organization_id = ?
                  AND related_entity_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(orgId, empId);
            const alerts = alertsRow?.count || 0;

            const availableAssets = Math.max(0, totalAssets - activeAssignments - inMaintenance);
            const utilizationRate = totalAssets > 0 ? ((activeAssignments / totalAssets) * 100).toFixed(1) : '0.0';

            return {
                totalAssets,
                total_assets: totalAssets,
                availableAssets,
                available_assets: availableAssets,
                activeAssignments,
                active_assignments: activeAssignments,
                utilizationRate: utilizationRate + '%',
                fleet_utilization: utilizationRate,
                inMaintenance,
                in_maintenance: inMaintenance,
                activeTasks,
                active_tasks: activeTasks,
                alerts,
                security_alerts: alerts,
                maintenance_cost: 0
            };
        }

        const totalAssetsRow = await db.prepare(`SELECT COUNT(*) as count FROM assets WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)`).get(orgId);
        const totalAssets = totalAssetsRow?.count || 0;

        const activeAssignmentsRow = await db.prepare(`
            SELECT COUNT(*) as count 
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? AND asn.returned_at IS NULL
        `).get(orgId);
        const activeAssignments = activeAssignmentsRow?.count || 0;

        const inMaintenanceRow = await db.prepare(`SELECT COUNT(*) as count FROM assets WHERE organization_id = ? AND status = 'IN_MAINTENANCE'`).get(orgId);
        const inMaintenance = inMaintenanceRow?.count || 0;

        const activeTasksRow = await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'COMPLETED' AND organization_id = ?").get(orgId);
        const activeTasks = activeTasksRow?.count || 0;

        const alertsRow = await db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = FALSE AND organization_id = ?').get(orgId);
        const alerts = alertsRow?.count || 0;

        const availableAssets = Math.max(0, totalAssets - activeAssignments - inMaintenance);
        const utilizationRate = totalAssets > 0 ? ((activeAssignments / totalAssets) * 100).toFixed(1) : '0.0';

        return {
            totalAssets,
            total_assets: totalAssets,
            availableAssets,
            available_assets: availableAssets,
            activeAssignments,
            active_assignments: activeAssignments,
            utilizationRate: utilizationRate + '%',
            fleet_utilization: utilizationRate,
            inMaintenance,
            in_maintenance: inMaintenance,
            activeTasks,
            active_tasks: activeTasks,
            alerts,
            security_alerts: alerts,
            maintenance_cost: 0
        };
    }

    async getAnalyticsData(user) {
        const db = connect();
        const orgId = user.organization_id;

        const statusRows = await db.prepare(`
            SELECT COALESCE(status, 'AVAILABLE') as status, COUNT(*) as count
            FROM assets
            WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)
            GROUP BY status
        `).all(orgId);

        const statusMap = { AVAILABLE: 0, ASSIGNED: 0, IN_MAINTENANCE: 0, MISSING: 0 };
        statusRows.forEach(r => { statusMap[r.status] = r.count; });

        const locationRows = await db.prepare(`
            SELECT COALESCE(l.name, 'Unassigned') as location_name, COUNT(a.id) as count
            FROM assets a
            LEFT JOIN zones z ON a.zone_id = z.id
            LEFT JOIN locations l ON z.location_id = l.id
            WHERE a.organization_id = ? AND (a.status != 'ARCHIVED' OR a.status IS NULL)
            GROUP BY l.name
            ORDER BY count DESC
            LIMIT 50
        `).all(orgId);

        const maintenanceTrends = await db.prepare(`
            SELECT strftime('%Y-%m', completed_at) as month, COUNT(*) as count
            FROM maintenance_records mr
            JOIN assets a ON mr.asset_id = a.id
            WHERE a.organization_id = ?
            GROUP BY month
            ORDER BY month ASC
            LIMIT 6
        `).all(orgId);

        const recentAssignments = await db.prepare(`
            SELECT date(assigned_at) as day, COUNT(*) as checkouts
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? AND asn.assigned_at >= datetime('now', '-7 days')
            GROUP BY day
            ORDER BY day ASC
        `).all(orgId);

        const recentReturns = await db.prepare(`
            SELECT date(returned_at) as day, COUNT(*) as returns
            FROM assignments asn
            JOIN assets a ON asn.asset_id = a.id
            WHERE a.organization_id = ? AND asn.returned_at >= datetime('now', '-7 days')
            GROUP BY day
            ORDER BY day ASC
        `).all(orgId);

        const alertBreakdown = await db.prepare(`
            SELECT severity, COUNT(*) as count
            FROM alerts
            WHERE organization_id = ?
            GROUP BY severity
        `).all(orgId);

        const status_breakdown = statusRows.map(r => ({ status: r.status, count: r.count }));
        const zone_distribution = locationRows.map(r => ({ zone_name: r.location_name, count: r.count }));

        return {
            statusMap,
            status_breakdown,
            locationRows,
            zone_distribution,
            maintenanceTrends,
            recentAssignments,
            recentReturns,
            alertBreakdown
        };
    }
}

module.exports = new ReportRepository();
