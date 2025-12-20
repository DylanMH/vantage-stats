// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    // Get all tasks with basic stats
    router.get('/', async (_req, res) => {
        try {
            const rows = await db.all(`
        SELECT
          t.name AS task_name,
          COUNT(r.id) AS runs,
          ROUND(AVG(r.accuracy), 2) AS avg_accuracy,
          ROUND(AVG(r.score), 2) AS avg_score,
          MAX(r.score) AS max_score,
          MAX(r.played_at) AS last_played
        FROM tasks t
        LEFT JOIN runs r ON r.task_id = t.id
        GROUP BY t.id
        ORDER BY last_played DESC NULLS LAST, runs DESC
      `);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'failed to fetch tasks' });
        }
    });

    // Get unique task names for filters
    router.get('/names', async (req, res) => {
        try {
            const { pack_id } = req.query;
            let sql;
            const params = [];
            
            if (pack_id) {
                sql = `
                    SELECT DISTINCT t.name
                    FROM tasks t
                    INNER JOIN pack_tasks pt ON t.id = pt.task_id
                    INNER JOIN runs r ON r.task_id = t.id
                    WHERE pt.pack_id = ?
                    ORDER BY t.name
                `;
                params.push(pack_id);
            } else {
                sql = `
                    SELECT DISTINCT t.name
                    FROM tasks t
                    INNER JOIN runs r ON r.task_id = t.id
                    ORDER BY t.name
                `;
            }
            
            const tasks = await db.all(sql, params);
            const taskNames = tasks.map(t => t.name);
            res.json(taskNames);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'task names failed' });
        }
    });

    // Task summary (for tasks table)
    router.get('/summary', async (req, res) => {
        try {
            const { pack_id, days, limit = 50 } = req.query;
            
            let timeFilter = '';
            const params = [];
            
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    timeFilter = 'AND datetime(r.played_at) >= datetime(?)';
                    params.push(today.toISOString());
                } else {
                    timeFilter = 'AND datetime(r.played_at) >= datetime(?)';
                    params.push(daysAgoIso(numDays));
                }
            }
            
            let sql;
            
            if (pack_id) {
                sql = `
                    SELECT 
                        t.name AS task_name,
                        COUNT(r.id) AS runs,
                        ROUND(CASE 
                            WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                            ELSE AVG(r.accuracy)
                        END, 2) AS avg_accuracy,
                        ROUND(AVG(r.score), 2) AS avg_score,
                        ROUND(AVG(r.shots), 2) AS avg_shots,
                        ROUND(AVG(r.hits), 2) AS avg_hits,
                        ROUND(AVG(r.avg_ttk), 6) AS avg_ttk,
                        ROUND(AVG(r.duration), 2) AS avg_duration,
                        ROUND(AVG(r.overshots), 2) AS avg_overshots,
                        MAX(r.score) AS max_score,
                        MAX(r.played_at) AS last_played
                    FROM tasks t
                    LEFT JOIN pack_tasks pt ON t.id = pt.task_id
                    LEFT JOIN runs r ON r.task_id = t.id AND r.is_practice = 0
                    WHERE pt.pack_id = ? ${timeFilter}
                    GROUP BY t.id
                    HAVING runs > 0
                    ORDER BY last_played DESC NULLS LAST, runs DESC
                    LIMIT ?
                `;
                const rows = await db.all(sql, [pack_id, ...params, Number(limit)]);
                res.json(rows);
            } else {
                const practiceFilter = 'r.is_practice = 0';
                const whereClause = timeFilter 
                    ? `WHERE ${practiceFilter} AND ${timeFilter.replace('AND ', '')}`
                    : `WHERE ${practiceFilter}`;
                sql = `
                    SELECT 
                        t.name AS task_name,
                        COUNT(r.id) AS runs,
                        ROUND(CASE 
                            WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                            ELSE AVG(r.accuracy)
                        END, 2) AS avg_accuracy,
                        ROUND(AVG(r.score), 2) AS avg_score,
                        ROUND(AVG(r.shots), 2) AS avg_shots,
                        ROUND(AVG(r.hits), 2) AS avg_hits,
                        ROUND(AVG(r.avg_ttk), 6) AS avg_ttk,
                        ROUND(AVG(r.duration), 2) AS avg_duration,
                        ROUND(AVG(r.overshots), 2) AS avg_overshots,
                        MAX(r.score) AS max_score,
                        MAX(r.played_at) AS last_played
                    FROM tasks t
                    LEFT JOIN runs r ON r.task_id = t.id
                    ${whereClause}
                    GROUP BY t.id
                    HAVING runs > 0
                    ORDER BY last_played DESC NULLS LAST, runs DESC
                    LIMIT ?
                `;
                const rows = await db.all(sql, [...params, Number(limit)]);
                res.json(rows);
            }
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'tasks summary failed' });
        }
    });

    // Best sensitivity settings for a task
    router.get('/:taskName/best-settings', async (req, res) => {
        try {
            const { taskName } = req.params;
            const { filterBy = 'score' } = req.query;
            
            let orderBy, whereColumn;
            if (filterBy === 'accuracy') {
                orderBy = 'r.accuracy DESC';
                whereColumn = 'r.accuracy';
            } else if (filterBy === 'ttk') {
                orderBy = 'r.avg_ttk ASC';
                whereColumn = 'r.avg_ttk';
            } else {
                orderBy = 'r.score DESC';
                whereColumn = 'r.score';
            }
            
            const query = `
                SELECT 
                    r.score,
                    r.accuracy,
                    r.played_at,
                    r.avg_ttk,
                    r.shots,
                    r.hits,
                    r.duration,
                    r.fps_avg,
                    r.overshots,
                    r.reloads,
                    json_extract(r.meta, '$.dpi') AS dpi,
                    json_extract(r.meta, '$.sens_h') AS sens_h,
                    json_extract(r.meta, '$.fov') AS fov,
                    t.name AS task_name
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                WHERE t.name = ? AND ${whereColumn} IS NOT NULL
                ORDER BY ${orderBy}
                LIMIT 1
            `;
            const bestRun = await db.get(query, [taskName]);
            
            if (!bestRun) {
                return res.status(404).json({ error: 'No runs found for this task' });
            }
            
            res.json(bestRun);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch best settings' });
        }
    });

    // Get current stats for a specific task
    router.get('/:taskId/stats', async (req, res) => {
        try {
            const { taskId } = req.params;
            
            const stats = await db.get(`
                SELECT 
                    AVG(accuracy) as avg_accuracy,
                    AVG(score) as avg_score,
                    AVG(avg_ttk) as avg_ttk,
                    COUNT(*) as total_runs
                FROM runs
                WHERE task_id = ? AND accuracy IS NOT NULL
            `, [taskId]);
            
            res.json(stats || {
                avg_accuracy: 0,
                avg_score: 0,
                avg_ttk: 0,
                total_runs: 0
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch task stats' });
        }
    });

    return router;
};
