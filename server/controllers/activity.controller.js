const activityRepository = require('../repositories/activity.repository');

class ActivityController {
    async getActivities(req, res) {
        try {
            const filters = {
                action: req.query.action,
                employee_id: req.query.employee_id,
                date_range: req.query.date_range,
                search: req.query.search
            };
            const activities = await activityRepository.getActivities(req.user, filters);
            res.json(activities);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async logActivity(req, res) {
        try {
            const activityData = {
                organization_id: req.user.organization_id,
                employee_id: req.user.employee_id,
                ...req.body
            };
            const id = await activityRepository.logActivity(activityData);
            res.status(201).json({ id, message: 'Activity logged' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ActivityController();
