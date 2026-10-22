const reportRepository = require('../repositories/report.repository');

class ReportController {
    async getAssetRegister(req, res) {
        try {
            const user = req.user;
            if (user.role_name === 'FIELD WORKER') return res.status(403).json({ error: 'Field Worker cannot access reports' });
            
            const data = await reportRepository.getAssetRegister(user, req.query);
            this.handleExport(req, res, data, 'asset_register');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMaintenanceHistory(req, res) {
        try {
            const user = req.user;
            if (user.role_name === 'FIELD WORKER') return res.status(403).json({ error: 'Field Worker cannot access reports' });

            const data = await reportRepository.getMaintenanceHistory(user, req.query);
            this.handleExport(req, res, data, 'maintenance_history');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEmployeeActivity(req, res) {
        try {
            const user = req.user;
            if (user.role_name === 'FIELD WORKER' || user.role_name === 'MAINTENANCE STAFF') {
                return res.status(403).json({ error: 'Unauthorized report access' });
            }

            const data = await reportRepository.getEmployeeActivity(user, req.query);
            this.handleExport(req, res, data, 'employee_activity');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getZoneUtilization(req, res) {
        try {
            const user = req.user;
            if (user.role_name === 'FIELD WORKER' || user.role_name === 'MAINTENANCE STAFF') {
                return res.status(403).json({ error: 'Unauthorized report access' });
            }

            const data = await reportRepository.getZoneUtilization(user, req.query);
            this.handleExport(req, res, data, 'zone_utilization');
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDashboardStats(req, res) {
        try {
            const stats = await reportRepository.getDashboardStats(req.user);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAnalyticsData(req, res) {
        try {
            const analytics = await reportRepository.getAnalyticsData(req.user);
            res.json(analytics);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    handleExport(req, res, data, filename) {
        if (req.query.format === 'csv') {
            if (!data || !data.length) {
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
