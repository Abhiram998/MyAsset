const { connect } = require('../db/database');

class SettingsRepository {
    async findByOrganizationId(orgId) {
        const db = connect();
        let settings = await db.prepare(`SELECT * FROM settings WHERE organization_id = ?`).get(orgId);
        const org = await db.prepare(`SELECT name FROM organizations WHERE id = ?`).get(orgId);

        if (!settings) {
            const defaultName = org ? org.name : 'MyAsset Organization';
            await db.prepare(`
                INSERT INTO settings (organization_id, company_name, notification_preferences)
                VALUES (?, ?, ?)
            `).run(orgId, defaultName, JSON.stringify({ email_alerts: true, push_notifications: false }));
            settings = await db.prepare(`SELECT * FROM settings WHERE organization_id = ?`).get(orgId);
        }

        return {
            organization_id: settings.organization_id,
            company_name: settings.company_name,
            notification_preferences: typeof settings.notification_preferences === 'string'
                ? JSON.parse(settings.notification_preferences || '{}')
                : settings.notification_preferences
        };
    }

    async upsert(orgId, companyName, notificationPreferences) {
        const db = connect();
        const prefsString = typeof notificationPreferences === 'object'
            ? JSON.stringify(notificationPreferences)
            : (notificationPreferences || '{}');

        const tx = db.transaction(async () => {
            await db.prepare(`
                INSERT INTO settings (organization_id, company_name, notification_preferences)
                VALUES (?, ?, ?)
                ON CONFLICT(organization_id) DO UPDATE SET 
                    company_name = COALESCE(excluded.company_name, settings.company_name),
                    notification_preferences = COALESCE(excluded.notification_preferences, settings.notification_preferences)
            `).run(orgId, companyName || 'MyAsset Workspace', prefsString);

            if (companyName) {
                await db.prepare(`UPDATE organizations SET name = ? WHERE id = ?`).run(companyName, orgId);
            }
        });

        await tx();
    }
}

module.exports = new SettingsRepository();
