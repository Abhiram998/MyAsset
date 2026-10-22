const { connect } = require('../db/database');

class TaskRepository {
    async findAll(user, filters = {}) {
        const db = connect();
        let query = `
            SELECT t.*, 
                   a.name as asset_name, a.tag_id as asset_tag,
                   e.first_name || ' ' || e.last_name as assigned_name,
                   z.name as zone_name,
                   (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id) as checklist_total,
                   (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id AND is_completed = TRUE) as checklist_completed
            FROM tasks t
            LEFT JOIN assets a ON t.asset_id = a.id
            LEFT JOIN employees e ON t.assignee_id = e.id
            LEFT JOIN zones z ON t.zone_id = z.id
            WHERE t.organization_id = ?
        `;
        const params = [user.organization_id];

        if (user.role_name === 'SITE / CREW SUPERVISOR') {
            query += ` AND (
                t.zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?) 
                OR t.assignee_id IN (
                    SELECT employee_id FROM employee_zones 
                    WHERE zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
                )
            )`;
            params.push(user.employee_id, user.employee_id);
        } else if (user.role_name === 'MAINTENANCE STAFF') {
            query += ` AND (
                t.asset_id IN (SELECT asset_id FROM maintenance_schedules) 
                OR t.asset_id IN (SELECT asset_id FROM maintenance_requests)
            )`;
        } else if (user.role_name === 'FIELD WORKER') {
            query += ` AND t.assignee_id = ?`;
            params.push(user.employee_id);
        }

        if (filters.status) {
            query += ` AND t.status = ?`;
            params.push(filters.status);
        }
        if (filters.assignee_id) {
            query += ` AND t.assignee_id = ?`;
            params.push(filters.assignee_id);
        }
        if (filters.asset_id) {
            query += ` AND t.asset_id = ?`;
            params.push(filters.asset_id);
        }
        if (filters.search) {
            query += ` AND (t.title LIKE ? OR t.description LIKE ? OR a.name LIKE ?)`;
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY t.created_at DESC`;
        return await db.prepare(query).all(...params);
    }

    async create(taskData) {
        const db = connect();
        const { organization_id, asset_id, title, description, status, assignee_id, zone_id, due_date, created_by_id, checklists } = taskData;
        
        let taskId;
        const tx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO tasks (organization_id, asset_id, title, description, status, assignee_id, zone_id, due_date, created_by_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(organization_id, asset_id || null, title, description || null, status || 'ASSIGNED', assignee_id || null, zone_id || null, due_date || null, created_by_id);
            
            taskId = result.lastInsertRowid;

            if (checklists && Array.isArray(checklists)) {
                for (const item of checklists) {
                    if (item && typeof item === 'string' && item.trim()) {
                        await db.prepare(`
                            INSERT INTO task_checklists (task_id, item_text, is_completed)
                            VALUES (?, ?, FALSE)
                        `).run(taskId, item.trim());
                    }
                }
            }
        });

        await tx();
        return taskId;
    }

    async findById(taskId, user) {
        const db = connect();
        const query = `
            SELECT t.*, 
                   a.name as asset_name, a.tag_id as asset_tag,
                   e.first_name || ' ' || e.last_name as assigned_name,
                   z.name as zone_name
            FROM tasks t
            LEFT JOIN assets a ON t.asset_id = a.id
            LEFT JOIN employees e ON t.assignee_id = e.id
            LEFT JOIN zones z ON t.zone_id = z.id
            WHERE t.id = ? AND t.organization_id = ?
        `;
        const task = await db.prepare(query).get(taskId, user.organization_id);
        if (!task) return null;

        // Apply strict scopes
        if (user.role_name === 'FIELD WORKER') {
            if (task.assignee_id !== user.employee_id) return null;
        } else if (user.role_name === 'SITE / CREW SUPERVISOR') {
            const inZone = await db.prepare(`SELECT 1 FROM employee_zones WHERE employee_id = ? AND zone_id = ?`).get(user.employee_id, task.zone_id);
            const inCrew = await db.prepare(`
                SELECT 1 FROM employee_zones 
                WHERE employee_id = ? 
                AND zone_id IN (SELECT zone_id FROM employee_zones WHERE employee_id = ?)
            `).get(task.assignee_id, user.employee_id);
            if (!inZone && !inCrew) return null;
        }

        task.checklists = await db.prepare(`
            SELECT * FROM task_checklists WHERE task_id = ? ORDER BY id ASC
        `).all(taskId);

        task.evidence = await db.prepare(`
            SELECT * FROM task_evidence WHERE task_id = ? ORDER BY uploaded_at ASC
        `).all(taskId);

        return task;
    }

    async updateStatus(taskId, status, timestampField) {
        const db = connect();
        let query = `UPDATE tasks SET status = ?`;
        if (timestampField === 'started_at') query += `, started_at = CURRENT_TIMESTAMP`;
        if (timestampField === 'completed_at') query += `, completed_at = CURRENT_TIMESTAMP`;
        query += ` WHERE id = ?`;
        await db.prepare(query).run(status, taskId);
    }

    async addChecklist(taskId, itemText) {
        const db = connect();
        const result = await db.prepare(`
            INSERT INTO task_checklists (task_id, item_text, is_completed)
            VALUES (?, ?, FALSE)
        `).run(taskId, itemText);
        return result.lastInsertRowid;
    }

    async toggleChecklist(checklistId, isCompleted) {
        const db = connect();
        const query = isCompleted
            ? `UPDATE task_checklists SET is_completed = TRUE, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
            : `UPDATE task_checklists SET is_completed = FALSE, completed_at = NULL WHERE id = ?`;
        await db.prepare(query).run(checklistId);
    }

    async addEvidence(taskId, filePath) {
        const db = connect();
        const result = await db.prepare(`
            INSERT INTO task_evidence (task_id, file_path)
            VALUES (?, ?)
        `).run(taskId, filePath);
        return result.lastInsertRowid;
    }
}

module.exports = new TaskRepository();
