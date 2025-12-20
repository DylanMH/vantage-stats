// backend/routes/goals.js
const express = require('express');
const router = express.Router();
const goals = require('../core/goals/goals');

module.exports = (db) => {
    // Get goals with optional filtering
    router.get('/', async (req, res) => {
        try {
            const { active, completed, limit } = req.query;
            const params = [];
            const where = [];

            if (active === 'true') {
                where.push('g.is_active = 1 AND gp.is_completed = 0');
            }
            if (completed === 'true') {
                where.push('gp.is_completed = 1');
            }

            let sql = `
                SELECT 
                    g.*,
                    gp.current_value,
                    gp.is_completed,
                    gp.completed_at,
                    t.name as target_task_name,
                    p.name as target_pack_name
                FROM goals g
                LEFT JOIN goal_progress gp ON g.id = gp.goal_id
                LEFT JOIN tasks t ON g.target_task_id = t.id
                LEFT JOIN packs p ON g.target_pack_id = p.id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY g.created_at DESC
            `;

            if (limit) {
                sql += ` LIMIT ?`;
                params.push(parseInt(limit));
            }

            const rows = await db.all(sql, params);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'goals query failed' });
        }
    });

    // Clean up duplicate goals
    router.post('/cleanup-duplicates', async (req, res) => {
        try {
            const duplicates = await db.all(`
                SELECT goal_type, COUNT(*) as count
                FROM goals
                WHERE is_active = 1
                GROUP BY goal_type
                HAVING count > 1
            `);

            let removed = 0;
            
            for (const dup of duplicates) {
                const goals = await db.all(`
                    SELECT id, created_at
                    FROM goals
                    WHERE goal_type = ? AND is_active = 1
                    ORDER BY created_at DESC
                `, [dup.goal_type]);

                for (let i = 1; i < goals.length; i++) {
                    await db.run(`
                        UPDATE goals SET is_active = 0 WHERE id = ?
                    `, [goals[i].id]);
                    removed++;
                }
            }

            res.json({ 
                success: true, 
                removed: removed,
                message: `Removed ${removed} duplicate goals`
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'cleanup failed' });
        }
    });

    // Test endpoint to simulate goal achievement
    router.post('/test-achievement', async (req, res) => {
        try {
            const goal = await db.get(`
                SELECT g.*, t.name as target_task_name
                FROM goals g
                LEFT JOIN tasks t ON g.target_task_id = t.id
                WHERE g.is_active = 1
                LIMIT 1
            `);

            if (!goal) {
                return res.status(404).json({ error: 'No active goals found' });
            }

            await db.run(`
                UPDATE goal_progress 
                SET is_completed = 0, completed_at = NULL
                WHERE goal_id = ?
            `, [goal.id]);

            await new Promise(resolve => setTimeout(resolve, 100));

            await db.run(`
                INSERT OR REPLACE INTO goal_progress (goal_id, current_value, is_completed, completed_at)
                VALUES (?, ?, 1, datetime('now'))
            `, [goal.id, goal.target_value]);

            res.json({ 
                success: true, 
                message: 'Goal marked as completed for testing (can be triggered again)',
                goal: goal
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'test achievement failed' });
        }
    });

    // Check for newly achieved goals
    router.get('/check-achievements', async (req, res) => {
        try {
            const { since } = req.query;
            
            const recentlyCompleted = await db.all(`
                SELECT 
                    g.*,
                    gp.current_value,
                    gp.completed_at,
                    t.name as target_task_name
                FROM goals g
                LEFT JOIN goal_progress gp ON g.id = gp.goal_id
                LEFT JOIN tasks t ON g.target_task_id = t.id
                WHERE gp.is_completed = 1 
                ${since ? "AND julianday(gp.completed_at) > julianday(?)" : ""}
                ORDER BY gp.completed_at DESC
                LIMIT 10
            `, since ? [since] : []);

            res.json(recentlyCompleted);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to check achievements' });
        }
    });

    // Get list of played tasks
    router.get('/played-tasks', async (_req, res) => {
        try {
            const tasks = await db.all(`
                SELECT DISTINCT t.id, t.name, t.skill_type, COUNT(r.id) as run_count
                FROM tasks t
                JOIN runs r ON t.id = r.task_id
                GROUP BY t.id, t.name, t.skill_type
                ORDER BY t.name ASC
            `);
            res.json(tasks);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch played tasks' });
        }
    });

    // Create a new user goal
    router.post('/create', async (req, res) => {
        try {
            const { 
                title, 
                description, 
                goal_type, 
                target_value, 
                target_task_id, 
                target_pack_id,
                time_window,
                time_window_hours,
                time_window_type
            } = req.body;

            if (!title || !goal_type || !target_value) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const validTypes = ['accuracy', 'score', 'ttk'];
            if (!validTypes.includes(goal_type)) {
                return res.status(400).json({ error: 'Invalid goal_type' });
            }

            if (!target_task_id && !target_pack_id) {
                return res.status(400).json({ error: 'Must specify either target_task_id or target_pack_id' });
            }

            let currentValue = 0;
            if (target_task_id) {
                const stats = await db.get(`
                    SELECT AVG(CASE 
                        WHEN ? = 'accuracy' THEN accuracy
                        WHEN ? = 'score' THEN score
                        WHEN ? = 'ttk' THEN avg_ttk
                    END) as current_value
                    FROM runs
                    WHERE task_id = ?
                `, [goal_type, goal_type, goal_type, target_task_id]);
                currentValue = stats?.current_value || 0;
            } else if (target_pack_id) {
                const stats = await db.get(`
                    SELECT AVG(CASE 
                        WHEN ? = 'accuracy' THEN r.accuracy
                        WHEN ? = 'score' THEN r.score
                        WHEN ? = 'ttk' THEN r.avg_ttk
                    END) as current_value
                    FROM runs r
                    JOIN pack_tasks pt ON r.task_id = pt.task_id
                    WHERE pt.pack_id = ?
                `, [goal_type, goal_type, goal_type, target_pack_id]);
                currentValue = stats?.current_value || 0;
            }

            const result = await db.run(`
                INSERT INTO goals (
                    title, description, goal_type, target_value,
                    target_task_id, target_pack_id,
                    is_active, is_user_created
                ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)
            `, [
                title, 
                description || null, 
                goal_type, 
                target_value,
                target_task_id || null, 
                target_pack_id || null
            ]);

            // Create goal_progress entry
            await db.run(`
                INSERT INTO goal_progress (goal_id, current_value, is_completed)
                VALUES (?, ?, 0)
            `, [result.lastID, currentValue]);

            const newGoal = await db.get(`
                SELECT g.*, gp.current_value, gp.is_completed
                FROM goals g
                LEFT JOIN goal_progress gp ON g.id = gp.goal_id
                WHERE g.id = ?
            `, [result.lastID]);
            res.json(newGoal);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to create goal' });
        }
    });

    // Delete a user-created goal
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const goal = await db.get('SELECT * FROM goals WHERE id = ?', [id]);
            if (!goal) {
                return res.status(404).json({ error: 'Goal not found' });
            }

            await db.run('DELETE FROM goals WHERE id = ?', [id]);
            res.json({ success: true, deletedGoalId: id });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to delete goal' });
        }
    });

    return router;
};
