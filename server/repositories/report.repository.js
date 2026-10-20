const { connect } = require('../db/database');

class ReportRepository {
    getDashboardStats(user) {
        const db = connect();
        
        let assetQuery = `SELECT count(*) as count FROM assets WHERE organization_id = ?`;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR' || user.role_name === 'FIELD WORKER') {
            assetQuery = `SELECT count(*) as count FROM assets a WHERE a.organization_id = ? AND a.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)`;
            params.push(user.employee_id);
        }

        const assetCount = db.prepare(assetQuery).get(...params).count;
        
        return {
            total_assets: assetCount,
            utilization_rate: 84.2, // Stubbed for MVP
            maintenance_cost: 4250, // Stubbed for MVP
            active_assignments: 76, // Stubbed for MVP
            alerts: 5 // Stubbed for MVP
        };
    }
}

module.exports = new ReportRepository();
