const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');
const { connect } = require('../db/database');

class UserController {
    async getAllUsers(req, res) {
        try {
            const orgId = req.user ? req.user.organization_id : null;
            if (!orgId) {
                return res.status(400).json({ error: 'Organization ID is required' });
            }
            const filters = {
                role: req.query.role || req.query.role_name,
                search: req.query.search || req.query.q
            };
            const users = await userRepository.findAll(orgId, filters);
            const formatted = (users || []).map(u => ({
                ...u,
                role: u.role_name,
                employee_name: (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : null
            }));
            res.json(formatted);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createUser(req, res) {
        try {
            const { email, password, role_id, role_name, role, first_name, last_name } = req.body;
            
            if (!email || typeof email !== 'string' || !email.trim()) {
                return res.status(400).json({ error: 'Email, password, and role are required' });
            }
            if (!password || typeof password !== 'string' || !password.trim()) {
                return res.status(400).json({ error: 'Email, password, and role are required' });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            const rawRole = (role_id !== undefined && role_id !== null && role_id !== '') 
                ? role_id 
                : (role_name || role);
            if (!rawRole) {
                return res.status(400).json({ error: 'Email, password, and role are required' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: 'Please provide a valid work email address' });
            }

            const db = connect();
            let roleRecord;
            if (typeof rawRole === 'number' || /^\d+$/.test(String(rawRole).trim())) {
                roleRecord = await db.prepare('SELECT id, name FROM roles WHERE id = ?').get(Number(rawRole));
            } else {
                roleRecord = await db.prepare('SELECT id, name FROM roles WHERE UPPER(name) = UPPER(?)').get(String(rawRole).trim());
            }

            if (!roleRecord) {
                return res.status(400).json({ error: 'Invalid role specified' });
            }

            const cleanEmail = email.trim().toLowerCase();
            const existing = await userRepository.findByEmail(cleanEmail);
            if (existing) {
                return res.status(409).json({ error: 'A user with this email already exists' });
            }

            const password_hash = await bcrypt.hash(password, 10);
            
            let userId;
            const tx = db.transaction(async () => {
                userId = await userRepository.create({
                    organization_id: req.user.organization_id,
                    email: cleanEmail,
                    password_hash,
                    role_id: roleRecord.id
                });

                const firstNameToSave = (first_name && first_name.trim()) 
                    ? first_name.trim() 
                    : (cleanEmail.split('@')[0] || 'User');
                const lastNameToSave = (last_name && last_name.trim()) 
                    ? last_name.trim() 
                    : '';

                const empRes = await db.prepare(`
                    INSERT INTO employees (user_id, organization_id, first_name, last_name, status)
                    VALUES (?, ?, ?, ?, 'ACTIVE')
                `).run(userId, req.user.organization_id, firstNameToSave, lastNameToSave);
                const employeeId = empRes.lastInsertRowid;

                // Support optional zone_id / zone_ids, or assign default primary zone if available
                const targetZoneId = req.body.zone_id || (Array.isArray(req.body.zone_ids) ? req.body.zone_ids[0] : null);
                if (targetZoneId) {
                    await db.prepare(`
                        INSERT INTO employee_zones (employee_id, zone_id)
                        VALUES (?, ?)
                        ON CONFLICT DO NOTHING
                    `).run(employeeId, Number(targetZoneId));
                } else {
                    const defZone = await db.prepare(`
                        SELECT z.id FROM zones z
                        JOIN locations l ON z.location_id = l.id
                        WHERE l.organization_id = ?
                        ORDER BY z.id ASC LIMIT 1
                    `).get(req.user.organization_id);
                    if (defZone && defZone.id) {
                        await db.prepare(`
                            INSERT INTO employee_zones (employee_id, zone_id)
                            VALUES (?, ?)
                            ON CONFLICT DO NOTHING
                        `).run(employeeId, defZone.id);
                    }
                }
            });
            await tx();

            const activityService = require('../services/activity.service');
            await activityService.logActivity(req.user, 'CREATED_USER', null, null, null, `Created user ${cleanEmail} (${roleRecord.name})`);

            res.status(201).json({ 
                id: userId, 
                message: 'User created successfully',
                email: cleanEmail,
                role: roleRecord.name,
                role_name: roleRecord.name,
                role_id: roleRecord.id
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateUserRole(req, res) {
        try {
            const userId = req.params.id;
            const { role_id, role_name, role } = req.body;
            const rawRole = (role_id !== undefined && role_id !== null && role_id !== '') 
                ? role_id 
                : (role_name || role);

            if (!rawRole) {
                return res.status(400).json({ error: 'role_id is required' });
            }

            const db = connect();
            let roleRecord;
            if (typeof rawRole === 'number' || /^\d+$/.test(String(rawRole).trim())) {
                roleRecord = await db.prepare('SELECT id, name FROM roles WHERE id = ?').get(Number(rawRole));
            } else {
                roleRecord = await db.prepare('SELECT id, name FROM roles WHERE UPPER(name) = UPPER(?)').get(String(rawRole).trim());
            }

            if (!roleRecord) {
                return res.status(400).json({ error: 'Invalid role specified' });
            }

            if (Number(userId) === Number(req.user.id) && roleRecord.name !== 'ADMIN') {
                return res.status(400).json({ error: 'Cannot demote your own administrator account' });
            }

            const success = await userRepository.updateRole(userId, req.user.organization_id, roleRecord.id);
            if (!success) {
                return res.status(404).json({ error: 'User not found in this organization' });
            }

            const activityService = require('../services/activity.service');
            await activityService.logActivity(req.user, 'UPDATED_USER_ROLE', null, null, null, `User ID ${userId} role changed to ${roleRecord.name}`);

            res.json({ message: 'User role updated successfully', role_id: roleRecord.id, role_name: roleRecord.name });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAllRoles(req, res) {
        try {
            const roles = await userRepository.findAllRoles();
            res.json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();
