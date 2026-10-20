const { connect } = require('../db/database');

class SettingsController {
    getSettings(req, res) {
        try {
            const db = connect();
            const orgId = req.user.organization_id;
            
            let settings = db.prepare(`SELECT * FROM settings WHERE organization_id = ?`).get(orgId);
            const org = db.prepare(`SELECT name FROM organizations WHERE id = ?`).get(orgId);

            if (!settings) {
                const defaultName = org ? org.name : 'MyAsset Organization';
                db.prepare(`
                    INSERT INTO settings (organization_id, company_name, notification_preferences)
                    VALUES (?, ?, ?)
                `).run(orgId, defaultName, JSON.stringify({ email_alerts: true, push_notifications: false }));
                settings = db.prepare(`SELECT * FROM settings WHERE organization_id = ?`).get(orgId);
            }

            res.json({
                organization_id: settings.organization_id,
                company_name: settings.company_name,
                notification_preferences: typeof settings.notification_preferences === 'string'
                    ? JSON.parse(settings.notification_preferences || '{}')
                    : settings.notification_preferences
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updateSettings(req, res) {
        try {
            const db = connect();
            const orgId = req.user.organization_id;
            const { company_name, notification_preferences } = req.body;

            const prefsString = typeof notification_preferences === 'object'
                ? JSON.stringify(notification_preferences)
                : (notification_preferences || '{}');

            const tx = db.transaction(() => {
                db.prepare(`
                    INSERT INTO settings (organization_id, company_name, notification_preferences)
                    VALUES (?, ?, ?)
                    ON CONFLICT(organization_id) DO UPDATE SET 
                        company_name = COALESCE(excluded.company_name, settings.company_name),
                        notification_preferences = COALESCE(excluded.notification_preferences, settings.notification_preferences)
                `).run(orgId, company_name || 'MyAsset Workspace', prefsString);

                if (company_name) {
                    db.prepare(`UPDATE organizations SET name = ? WHERE id = ?`).run(company_name, orgId);
                }
            });

            tx();

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'UPDATED_SETTINGS', null, null, null, `Updated company settings to "${company_name}"`);

            res.json({ message: 'Settings saved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SettingsController();
