const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');
const { connect } = require('../db/database');

class UserController {
    getAllUsers(req, res) {
        try {
            const users = userRepository.findAll(req.user.organization_id);
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createUser(req, res) {
        try {
            const { email, password, role_id, first_name, last_name } = req.body;
            if (!email || !password || !role_id) {
                return res.status(400).json({ error: 'Email, password, and role are required' });
            }

            const existing = userRepository.findByEmail(email);
            if (existing) {
                return res.status(409).json({ error: 'A user with this email already exists' });
            }

            const db = connect();
            const password_hash = await bcrypt.hash(password, 10);
            
            let userId;
            const tx = db.transaction(() => {
                userId = userRepository.create({
                    organization_id: req.user.organization_id,
                    email,
                    password_hash,
                    role_id: Number(role_id)
                });

                if (first_name || last_name) {
                    db.prepare(`
                        INSERT INTO employees (user_id, organization_id, first_name, last_name, status)
                        VALUES (?, ?, ?, ?, 'ACTIVE')
                    `).run(userId, req.user.organization_id, first_name || 'User', last_name || '');
                }
            });
            tx();

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'CREATED_USER', null, null, null, `Created user ${email}`);

            res.status(201).json({ id: userId, message: 'User created successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    updateUserRole(req, res) {
        try {
            const userId = req.params.id;
            const { role_id } = req.body;
            if (!role_id) {
                return res.status(400).json({ error: 'role_id is required' });
            }

            const success = userRepository.updateRole(userId, req.user.organization_id, Number(role_id));
            if (!success) {
                return res.status(404).json({ error: 'User not found' });
            }

            const activityService = require('../services/activity.service');
            activityService.logActivity(req.user, 'UPDATED_USER_ROLE', null, null, null, `User ID ${userId} role changed to ${role_id}`);

            res.json({ message: 'User role updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    getAllRoles(req, res) {
        try {
            const roles = userRepository.findAllRoles();
            res.json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();
