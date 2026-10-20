const assignmentService = require('../services/assignment.service');

class AssignmentController {
    getAllAssignments(req, res) {
        try {
            const filters = {
                filter: req.query.filter,
                asset_id: req.query.asset_id ? Number(req.query.asset_id) : undefined,
                employee_id: req.query.employee_id ? Number(req.query.employee_id) : undefined,
                search: req.query.search
            };
            const assignments = assignmentService.getAllAssignments(req.user, filters);
            res.json(assignments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    checkout(req, res) {
        try {
            const { asset_id, employee_id, expected_return, notes } = req.body;
            if (!asset_id || !employee_id) {
                return res.status(400).json({ error: 'Asset and Employee are required for checkout' });
            }

            const id = assignmentService.checkout({
                asset_id: Number(asset_id),
                employee_id: Number(employee_id),
                expected_return,
                notes
            }, req.user);

            res.status(201).json({ id, message: 'Asset successfully checked out' });
        } catch (error) {
            if (error.message.includes('cannot be checked out') || error.message.includes('not available')) {
                return res.status(409).json({ error: error.message });
            }
            if (error.message.includes('only assign equipment to crew')) {
                return res.status(403).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }

    returnAsset(req, res) {
        try {
            const id = req.params.id;
            assignmentService.returnAsset(Number(id), req.user);
            res.json({ message: 'Asset checked in successfully' });
        } catch (error) {
            if (error.message.includes('only return assets checked out to yourself')) {
                return res.status(403).json({ error: error.message });
            }
            if (error.message.includes('already been returned')) {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }

    getStats(req, res) {
        try {
            const stats = assignmentService.getStats(req.user);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AssignmentController();
