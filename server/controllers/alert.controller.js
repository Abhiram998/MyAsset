const alertRepository = require('../repositories/alert.repository');
const { connect } = require('../db/database');

class AlertController {
    async getAlerts(req, res) {
        try {
            const filters = {
                status: req.query.status,
                severity: req.query.severity
            };
            const alerts = await alertRepository.getAlerts(req.user, filters);
            res.json(alerts);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getStats(req, res) {
        try {
            const stats = await alertRepository.getStats(req.user);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createAlert(req, res) {
        try {
            const { type, severity, message, related_entity_id } = req.body;
            if (!type || !message) {
                return res.status(400).json({ error: 'Type and message are required' });
            }

            const alertResult = await alertRepository.createAlert({
                organization_id: req.user.organization_id,
                type,
                severity,
                message,
                related_entity_id: related_entity_id ? Number(related_entity_id) : null
            });

            if (alertResult.isDuplicate) {
                return res.status(200).json({ id: alertResult.id, message: 'Alert already active for this asset (deduplicated)', duplicate: true });
            }

            const activityService = require('../services/activity.service');
            await activityService.logActivity(req.user, 'TRIGGERED_ALERT', related_entity_id || null, null, null, `Alert: ${message}`);

            res.status(201).json({ id: alertResult.id, message: 'Alert created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async resolveAlert(req, res) {
        try {
            const { id } = req.params;
            
            // Scope check: Field workers can't resolve alerts
            if (req.user.role_name === 'FIELD WORKER') return res.status(403).json({ error: 'Unauthorized to resolve alerts' });

            const success = await alertRepository.resolveAlert(id, req.user.id, req.user.organization_id);
            if (!success) return res.status(404).json({ error: 'Alert not found or already resolved' });

            const activityService = require('../services/activity.service');
            await activityService.logActivity(req.user, 'RESOLVED_ALERT', null, null, null, `Resolved alert ID ${id}`);

            res.json({ message: 'Alert resolved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AlertController();
