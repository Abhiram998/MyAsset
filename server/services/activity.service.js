const activityRepository = require('../repositories/activity.repository');

class ActivityService {
    async logActivity(user, action, asset_id = null, task_id = null, zone_id = null, details = null) {
        if (!user || !user.organization_id || !user.employee_id) return;

        try {
            await activityRepository.logActivity({
                organization_id: user.organization_id,
                employee_id: user.employee_id,
                action,
                asset_id,
                task_id,
                zone_id,
                details
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
            // Non-blocking
        }
    }
}

module.exports = new ActivityService();
