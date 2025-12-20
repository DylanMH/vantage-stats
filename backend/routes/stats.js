// backend/routes/stats.js
const express = require('express');
const router = express.Router();
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    // Get global statistics with optional filtering
    router.get('/global', async (req, res) => {
        try {
            const { days, pack_id, task } = req.query;
            const params = [];
            const whereConditions = ['r.is_practice = 0'];
            
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(today.toISOString());
                } else {
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(daysAgoIso(numDays));
                }
            }
            
            if (pack_id) {
                whereConditions.push('pt.pack_id = ?');
                params.push(pack_id);
            }
            
            if (task) {
                whereConditions.push('t.name = ?');
                params.push(task);
            }
            
            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
            
            let fromClause = 'FROM runs r';
            if (pack_id) {
                fromClause += ' LEFT JOIN tasks t ON t.id = r.task_id LEFT JOIN pack_tasks pt ON t.id = pt.task_id';
            } else if (task) {
                fromClause += ' LEFT JOIN tasks t ON t.id = r.task_id';
            }

            const globalStats = await db.get(`
                SELECT 
                    COUNT(*) as total_runs,
                    COUNT(DISTINCT r.task_id) as unique_tasks,
                    CASE 
                        WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                        ELSE AVG(r.accuracy)
                    END as avg_accuracy,
                    MAX(r.accuracy) as max_accuracy,
                    AVG(r.score) as avg_score,
                    MAX(r.score) as max_score,
                    AVG(r.shots) as avg_shots,
                    SUM(r.shots) as total_shots,
                    AVG(r.duration) as avg_duration,
                    SUM(r.duration) as total_duration,
                    AVG(r.avg_ttk) as avg_ttk,
                    AVG(r.overshots) as avg_overshots,
                    AVG(r.reloads) as avg_reload_count,
                    AVG(r.fps_avg) as avg_fps
                ${fromClause}
                ${whereClause}
            `, params);

            res.json(globalStats);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'global stats failed' });
        }
    });

    // Overall performance history (all tasks over time)
    router.get('/history', async (req, res) => {
        try {
            const { days, limit = 1000, pack_id } = req.query;
            
            let whereConditions = ['r.is_practice = 0'];
            const params = [];
            
            if (days) {
                const numDays = parseInt(days);
                if (numDays === 1) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(today.toISOString());
                } else {
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(daysAgoIso(numDays));
                }
            }
            
            if (pack_id) {
                whereConditions.push(`t.id IN (SELECT task_id FROM pack_tasks WHERE pack_id = ?)`);
                params.push(parseInt(pack_id));
            }
            
            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
            
            const history = await db.all(`
                SELECT 
                    r.played_at,
                    r.score,
                    r.accuracy,
                    r.avg_ttk,
                    r.shots,
                    r.hits,
                    r.duration,
                    t.name as task_name,
                    json_extract(r.meta, '$.dpi') AS dpi,
                    json_extract(r.meta, '$.sens_h') AS sens_h,
                    json_extract(r.meta, '$.fov') AS fov
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                ${whereClause}
                ORDER BY r.played_at DESC
                LIMIT ?
            `, [...params, parseInt(limit)]);
            
            res.json(history);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'history lookup failed' });
        }
    });

    return router;
};
