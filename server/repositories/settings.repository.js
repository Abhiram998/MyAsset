const { connect } = require('../db/database');

class SettingsRepository {
    findByOrganizationId(orgId) {
        const db = connect();
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

        return {
            organization_id: settings.organization_id,
            company_name: settings.company_name,
            notification_preferences: typeof settings.notification_preferences === 'string'
                ? JSON.parse(settings.notification_preferences || '{}')
                : settings.notification_preferences
        };
    }

    upsert(orgId, companyName, notificationPreferences) {
        const db = connect();
        const prefsString = typeof notificationPreferences === 'object'
            ? JSON.stringify(notificationPreferences)
            : (notificationPreferences || '{}');

        const tx = db.transaction(() => {
            db.prepare(`
                INSERT INTO settings (organization_id, company_name, notification_preferences)
                VALUES (?, ?, ?)
                ON CONFLICT(organization_id) DO UPDATE SET 
                    company_name = COALESCE(excluded.company_name, settings.company_name),
                    notification_preferences = COALESCE(excluded.notification_preferences, settings.notification_preferences)
            `).run(orgId, companyName || 'MyAsset Workspace', prefsString);

            if (companyName) {
                db.prepare(`UPDATE organizations SET name = ? WHERE id = ?`).run(companyName, orgId);
            }
        });

        tx();
    }
}

module.exports = new SettingsRepository();
