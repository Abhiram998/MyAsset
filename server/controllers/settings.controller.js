const settingsRepository = require('../repositories/settings.repository');
const activityService = require('../services/activity.service');

class SettingsController {
    async getSettings(req, res) {
        try {
            const orgId = req.user.organization_id;
            const settings = await settingsRepository.findByOrganizationId(orgId);
            res.json(settings);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSettings(req, res) {
        try {
            const orgId = req.user.organization_id;
            const { company_name, notification_preferences } = req.body;

            await settingsRepository.upsert(orgId, company_name, notification_preferences);

            await activityService.logActivity(req.user, 'UPDATED_SETTINGS', null, null, null, `Updated company settings to "${company_name}"`);

            res.json({ message: 'Settings saved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SettingsController();
