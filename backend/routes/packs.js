// backend/routes/packs.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Get all packs with task count
    router.get('/', async (_req, res) => {
        try {
            const rows = await db.all(`
                SELECT 
                    p.*,
                    COUNT(pt.task_id) as task_count
                FROM packs p
                LEFT JOIN pack_tasks pt ON p.id = pt.pack_id
                GROUP BY p.id
                ORDER BY p.name ASC
            `);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'failed to fetch packs' });
        }
    });

    // Create a new pack
    router.post('/', async (req, res) => {
        try {
            const { name, description, game_focus, tasks } = req.body;
            
            const result = await db.run(
                `INSERT INTO packs (name, description, game_focus) VALUES (?, ?, ?)`,
                [name, description || null, game_focus || null]
            );
            
            const packId = result.lastID;
            
            if (tasks && tasks.length > 0) {
                for (const taskName of tasks) {
                    const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);
                    if (task) {
                        await db.run(
                            `INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`,
                            [packId, task.id]
                        );
                    }
                }
            }
            
            const pack = await db.get(`SELECT * FROM packs WHERE id = ?`, [packId]);
            res.json(pack);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'failed to create pack' });
        }
    });

    // Delete a pack
    router.delete('/:id', async (req, res) => {
        try {
            const packId = req.params.id;
            
            await db.run(`DELETE FROM pack_tasks WHERE pack_id = ?`, [packId]);
            await db.run(`DELETE FROM packs WHERE id = ?`, [packId]);
            
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'failed to delete pack' });
        }
    });

    // Get pack details with tasks
    router.get('/:id/tasks', async (req, res) => {
        try {
            const packId = req.params.id;
            const pack = await db.get(`SELECT * FROM packs WHERE id = ?`, [packId]);
            
            if (!pack) {
                return res.status(404).json({ error: 'Pack not found' });
            }
            
            const tasks = await db.all(`
                SELECT t.* 
                FROM tasks t
                INNER JOIN pack_tasks pt ON t.id = pt.task_id
                WHERE pt.pack_id = ?
                ORDER BY t.name ASC
            `, [packId]);
            
            res.json({ ...pack, tasks });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'failed to fetch pack tasks' });
        }
    });

    // Get current stats for a specific pack
    router.get('/:packId/stats', async (req, res) => {
        try {
            const { packId } = req.params;
            
            const stats = await db.get(`
                SELECT 
                    AVG(r.accuracy) as avg_accuracy,
                    AVG(r.score) as avg_score,
                    AVG(r.avg_ttk) as avg_ttk,
                    COUNT(DISTINCT r.id) as total_runs,
                    COUNT(DISTINCT r.task_id) as tasks_played
                FROM runs r
                JOIN pack_tasks pt ON r.task_id = pt.task_id
                WHERE pt.pack_id = ? AND r.accuracy IS NOT NULL
            `, [packId]);
            
            res.json(stats || {
                avg_accuracy: 0,
                avg_score: 0,
                avg_ttk: 0,
                total_runs: 0,
                tasks_played: 0
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch pack stats' });
        }
    });

    return router;
};
