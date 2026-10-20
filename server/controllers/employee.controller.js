const employeeRepository = require('../repositories/employee.repository');

class EmployeeController {
    getAllEmployees(req, res) {
        try {
            const filters = {
                search: req.query.search,
                status: req.query.status,
                role: req.query.role
            };
            const employees = employeeRepository.findAll(req.user, filters);
            res.json(employees);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getEmployeeById(req, res) {
        try {
            const employee = employeeRepository.findById(req.params.id, req.user);
            if (!employee) {
                return res.status(404).json({ error: 'Employee not found or access denied' });
            }
            res.json(employee);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    createEmployee(req, res) {
        try {
            const { first_name, last_name } = req.body;
            if (!first_name || !last_name) {
                return res.status(400).json({ error: 'First name and last name are required' });
            }

            const id = employeeRepository.create(req.body, req.user);

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_EMPLOYEE', null, null, null, `Created employee ${first_name} ${last_name}`);

            res.status(201).json({ id, message: 'Employee created successfully' });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }

    updateEmployee(req, res) {
        try {
            const id = req.params.id;
            const updated = employeeRepository.update(id, req.body, req.user);
            if (!updated) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'UPDATED_EMPLOYEE', null, null, null, `Updated employee ID ${id}`);

            res.json({ message: 'Employee updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new EmployeeController();
