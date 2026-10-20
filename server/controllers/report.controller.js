const { connect } = require('../db/database');

class ReportController {
    getAssetRegister(req, res) {
        try {
            const db = connect();
            const user = req.user;
            
            // Scope: Admin/Ops = All. Supervisor = Assigned Zones. Maintenance = Maint assets. Field = No.
            if (user.role_name === 'FIELD WORKER') return res.status(403).json({ error: 'Field Worker cannot access reports' });
            
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
            }

            query += ` ORDER BY a.created_at DESC`;

            const data = db.prepare(query).all(...params);
            this.handleExport(req, res, data, 'asset_register');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getMaintenanceHistory(req, res) {
        try {
            const db = connect();
            const user = req.user;
            if (user.role_name === 'FIELD WORKER') return res.status(403).json({ error: 'Field Worker cannot access reports' });

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
            }

            query += ` ORDER BY mr.completed_at DESC`;

            const data = db.prepare(query).all(...params);
            this.handleExport(req, res, data, 'maintenance_history');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getEmployeeActivity(req, res) {
        try {
            const db = connect();
            const user = req.user;
            if (user.role_name === 'FIELD WORKER' || user.role_name === 'MAINTENANCE STAFF') return res.status(403).json({ error: 'Unauthorized report access' });

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
            }

            query += ` ORDER BY ac.created_at DESC`;

            const data = db.prepare(query).all(...params);
            this.handleExport(req, res, data, 'employee_activity');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getZoneUtilization(req, res) {
        try {
            const db = connect();
            const user = req.user;
            if (user.role_name === 'FIELD WORKER' || user.role_name === 'MAINTENANCE STAFF') return res.status(403).json({ error: 'Unauthorized report access' });

            let query = `
                SELECT z.name as zone, l.name as location,
                       COUNT(a.id) as total_assets,
                       SUM(CASE WHEN a.status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned_assets
                FROM zones z
                LEFT JOIN assets a ON z.id = a.zone_id AND (a.status != 'ARCHIVED' OR a.status IS NULL)
                JOIN locations l ON z.location_id = l.id
                WHERE l.organization_id = ?
                GROUP BY z.id
            `;
            const params = [user.organization_id];

            if (user.role_name === 'SITE / CREW SUPERVISOR') {
                query += ` AND z.id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
                params.push(user.employee_id);
            }

            const data = db.prepare(query).all(...params);
            this.handleExport(req, res, data, 'zone_utilization');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getDashboardStats(req, res) {
        try {
            const db = connect();
            const orgId = req.user.organization_id;

            const totalAssets = db.prepare(`SELECT COUNT(*) as count FROM assets WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)`).get(orgId).count;
            const activeAssignments = db.prepare(`
                SELECT COUNT(*) as count 
                FROM assignments asn
                JOIN assets a ON asn.asset_id = a.id
                WHERE a.organization_id = ? AND asn.returned_at IS NULL
            `).get(orgId).count;
            const inMaintenance = db.prepare(`SELECT COUNT(*) as count FROM assets WHERE organization_id = ? AND status = 'IN_MAINTENANCE'`).get(orgId).count;
            const activeTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'COMPLETED' AND organization_id = ?").get(orgId).count;
            const alerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0 AND organization_id = ?').get(orgId).count;

            const utilizationRate = totalAssets > 0 ? ((activeAssignments / totalAssets) * 100).toFixed(1) : '0.0';

            res.json({
                totalAssets,
                activeAssignments,
                utilizationRate: utilizationRate + '%',
                inMaintenance,
                activeTasks,
                alerts
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getAnalyticsData(req, res) {
        try {
            const db = connect();
            const orgId = req.user.organization_id;

            // 1. Status breakdown
            const statusRows = db.prepare(`
                SELECT COALESCE(status, 'AVAILABLE') as status, COUNT(*) as count
                FROM assets
                WHERE organization_id = ? AND (status != 'ARCHIVED' OR status IS NULL)
                GROUP BY status
            `).all(orgId);

            const statusMap = { AVAILABLE: 0, ASSIGNED: 0, IN_MAINTENANCE: 0, MISSING: 0 };
            statusRows.forEach(r => { statusMap[r.status] = r.count; });

            // 2. Location distribution
            const locationRows = db.prepare(`
                SELECT COALESCE(l.name, 'Unassigned') as location_name, COUNT(a.id) as count
                FROM assets a
                LEFT JOIN zones z ON a.zone_id = z.id
                LEFT JOIN locations l ON z.location_id = l.id
                WHERE a.organization_id = ? AND (a.status != 'ARCHIVED' OR a.status IS NULL)
                GROUP BY l.name
                ORDER BY count DESC
            `).all(orgId);

            // 3. Maintenance trends (by month for last 6 months)
            const maintenanceTrends = db.prepare(`
                SELECT strftime('%Y-%m', completed_at) as month, COUNT(*) as count
                FROM maintenance_records mr
                JOIN assets a ON mr.asset_id = a.id
                WHERE a.organization_id = ?
                GROUP BY month
                ORDER BY month ASC
                LIMIT 6
            `).all(orgId);

            // 4. Checkouts vs Returns in the last 7 days
            const recentAssignments = db.prepare(`
                SELECT date(assigned_at) as day, COUNT(*) as checkouts
                FROM assignments asn
                JOIN assets a ON asn.asset_id = a.id
                WHERE a.organization_id = ? AND asn.assigned_at >= datetime('now', '-7 days')
                GROUP BY day
                ORDER BY day ASC
            `).all(orgId);

            const recentReturns = db.prepare(`
                SELECT date(returned_at) as day, COUNT(*) as returns
                FROM assignments asn
                JOIN assets a ON asn.asset_id = a.id
                WHERE a.organization_id = ? AND asn.returned_at >= datetime('now', '-7 days')
                GROUP BY day
                ORDER BY day ASC
            `).all(orgId);

            // 5. Alert counts by severity
            const alertBreakdown = db.prepare(`
                SELECT severity, COUNT(*) as count
                FROM alerts
                WHERE organization_id = ?
                GROUP BY severity
            `).all(orgId);

            res.json({
                statusMap,
                locationRows,
                maintenanceTrends,
                recentAssignments,
                recentReturns,
                alertBreakdown
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    handleExport(req, res, data, filename) {
        if (req.query.format === 'csv') {
            if (!data.length) {
                res.header('Content-Type', 'text/csv');
                res.attachment(`${filename}.csv`);
                return res.send('');
            }
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => Object.values(row).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',')).join('\n');
            res.header('Content-Type', 'text/csv');
            res.attachment(`${filename}.csv`);
            return res.send(`${headers}\n${rows}`);
        }
        res.json(data);
    }
}

module.exports = new ReportController();
