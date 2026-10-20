const taskRepository = require('../repositories/task.repository');

class TaskController {
    getAllTasks(req, res) {
        try {
            const filters = {
                status: req.query.status,
                assignee_id: req.query.assignee_id ? Number(req.query.assignee_id) : undefined,
                asset_id: req.query.asset_id ? Number(req.query.asset_id) : undefined,
                search: req.query.search
            };
            const tasks = taskRepository.findAll(req.user, filters);
            res.json(tasks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getTaskById(req, res) {
        try {
            const task = taskRepository.findById(req.params.id, req.user);
            if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
            res.json(task);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createTask(req, res) {
        try {
            const { title } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Task title is required' });
            }

            const taskData = {
                organization_id: req.user.organization_id,
                created_by_id: req.user.id,
                ...req.body
            };
            const id = taskRepository.create(taskData);
            
            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_TASK', taskData.asset_id, id, taskData.zone_id, `Created task: ${title}`);

            res.status(201).json({ id, message: 'Task created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updateTaskStatus(req, res) {
        try {
            const taskId = req.params.id;
            const { status } = req.body;
            
            const task = taskRepository.findById(taskId, req.user);
            if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

            // Strict state machine validation:
            // ASSIGNED -> IN PROGRESS -> VERIFICATION -> COMPLETED (or back to IN PROGRESS from VERIFICATION)
            const validTransitions = {
                'ASSIGNED': ['IN PROGRESS'],
                'IN PROGRESS': ['VERIFICATION'],
                'VERIFICATION': ['COMPLETED', 'IN PROGRESS']
            };

            if (!validTransitions[task.status] || !validTransitions[task.status].includes(status)) {
                return res.status(409).json({ error: `Invalid transition from ${task.status} to ${status}` });
            }

            let timestampField = null;
            if (status === 'IN PROGRESS' && task.status === 'ASSIGNED') timestampField = 'started_at';
            if (status === 'COMPLETED') timestampField = 'completed_at';

            taskRepository.updateStatus(taskId, status, timestampField);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, `UPDATED_TASK_STATUS_TO_${status.replace(/\s+/g, '_')}`, task.asset_id, taskId, task.zone_id, `Task "${task.title}" status changed to ${status}`);

            res.json({ message: 'Task status updated successfully', status });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    addChecklistItem(req, res) {
        try {
            const taskId = req.params.id;
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: 'Item text is required' });

            const task = taskRepository.findById(taskId, req.user);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const id = taskRepository.addChecklist(taskId, text);
            res.status(201).json({ id, message: 'Checklist item added' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    toggleChecklistItem(req, res) {
        try {
            const checklistId = req.params.itemId;
            const { is_completed } = req.body;

            taskRepository.toggleChecklist(checklistId, !!is_completed);
            res.json({ message: 'Checklist item updated' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    addEvidence(req, res) {
        try {
            const taskId = req.params.id;
            const { file_path } = req.body;
            if (!file_path) return res.status(400).json({ error: 'file_path is required' });

            const task = taskRepository.findById(taskId, req.user);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const id = taskRepository.addEvidence(taskId, file_path);
            res.status(201).json({ id, message: 'Evidence recorded' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TaskController();
