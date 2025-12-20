// backend/routes/user.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Get user profile with computed stats from runs
    router.get('/profile', async (_req, res) => {
        try {
            let user = await db.get(`SELECT * FROM users WHERE id = 1`);
            
            if (!user) {
                await db.run(`INSERT INTO users (id, username) VALUES (1, 'Player')`);
                user = await db.get(`SELECT * FROM users WHERE id = 1`);
            }

            const totalStats = await db.get(`
                SELECT 
                    COUNT(*) as total_runs, 
                    COUNT(DISTINCT task_id) as unique_tasks,
                    SUM(duration) as total_playtime
                FROM runs
                WHERE is_practice = 0
            `);

            const updatedUser = {
                ...user,
                total_runs: totalStats.total_runs || 0,
                unique_tasks: totalStats.unique_tasks || 0,
                total_playtime: totalStats.total_playtime || 0
            };

            res.json(updatedUser);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'profile lookup failed' });
        }
    });

    return router;
};
