const maintenanceRepository = require('../repositories/maintenance.repository');

class MaintenanceController {
    getStats(req, res) {
        try {
            const stats = maintenanceRepository.getStats(req.user);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getSchedules(req, res) {
        try {
            const filters = {
                status: req.query.status,
                asset_id: req.query.asset_id ? Number(req.query.asset_id) : undefined
            };
            const schedules = maintenanceRepository.getSchedules(req.user, filters);
            res.json(schedules);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createSchedule(req, res) {
        try {
            const { asset_id, title, due_date, priority, notes } = req.body;
            if (!asset_id || !title || !due_date) {
                return res.status(400).json({ error: 'Asset ID, title, and due date are required' });
            }

            const id = maintenanceRepository.createSchedule({
                asset_id: Number(asset_id),
                title,
                due_date,
                priority,
                notes
            }, req.user);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'SCHEDULED_MAINTENANCE', Number(asset_id), null, null, `Scheduled "${title}" for ${due_date}`);

            res.status(201).json({ id, message: 'Maintenance schedule created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    completeSchedule(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            maintenanceRepository.completeSchedule(id, notes, req.user.employee_id, req.user);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'COMPLETED_MAINTENANCE_SCHEDULE', null, null, null, `Completed maintenance schedule ID ${id}`);

            res.json({ message: 'Maintenance schedule marked completed' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getRequests(req, res) {
        try {
            const filters = {
                status: req.query.status,
                asset_id: req.query.asset_id ? Number(req.query.asset_id) : undefined
            };
            const requests = maintenanceRepository.getRequests(req.user, filters);
            res.json(requests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createRequest(req, res) {
        try {
            const { asset_id, description, priority } = req.body;
            if (!asset_id || !description) {
                return res.status(400).json({ error: 'Asset and issue description are required' });
            }

            if (req.user.role_name === 'FIELD WORKER') {
                const { connect } = require('../db/database');
                const db = connect();
                const isAssignee = db.prepare(`SELECT 1 FROM assignments WHERE asset_id = ? AND employee_id = ? AND returned_at IS NULL`).get(asset_id, req.user.employee_id);
                if (!isAssignee) return res.status(403).json({ error: 'You can only create requests for your assigned assets' });
            }

            const requestData = {
                asset_id: Number(asset_id),
                reporter_id: req.user.employee_id || 1,
                description,
                priority
            };
            const id = maintenanceRepository.createRequest(requestData, req.user);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_MAINTENANCE_REQUEST', requestData.asset_id, null, null, requestData.description);

            res.status(201).json({ id, message: 'Maintenance request created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updateRequestStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;
            
            // Only Maintenance Staff or Ops/Admin can update status
            if (req.user.role_name === 'FIELD WORKER' || req.user.role_name === 'SITE / CREW SUPERVISOR') {
                return res.status(403).json({ error: 'Unauthorized to update maintenance status' });
            }

            const request = maintenanceRepository.getRequestById(id);
            if (!request) return res.status(404).json({ error: 'Request not found' });

            const validTransitions = {
                'OPEN': ['IN PROGRESS'],
                'IN PROGRESS': ['COMPLETED', 'OPEN'],
                'COMPLETED': ['OPEN']
            };

            if (!validTransitions[request.status] || !validTransitions[request.status].includes(status)) {
                return res.status(409).json({ error: `Invalid transition from ${request.status} to ${status}` });
            }

            maintenanceRepository.updateRequestStatus(id, status, notes, req.user.employee_id || 1);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, `MAINTENANCE_REQUEST_${status.replace(/\s+/g, '_')}`, request.asset_id, null, null, notes || `Status changed to ${status}`);

            res.json({ message: 'Request status updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MaintenanceController();
