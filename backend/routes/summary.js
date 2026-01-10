// backend/routes/summary.js
const express = require('express');
const router = express.Router();
const CacheManager = require('../services/cacheManager');
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    const cacheManager = new CacheManager(db);

    // Global summary (for Home cards) - using cache
    router.get('/', async (req, res) => {
        try {
            const days = Number(req.query.days ?? 7);
            
            // Use cached time stats for common periods
            let periodKey = 'all';
            if (days === 1) periodKey = 'today';
            else if (days === 7) periodKey = '7days';
            else if (days === 30) periodKey = '30days';

            const cachedStats = await cacheManager.getTimeStats(periodKey);
            
            if (cachedStats) {
                return res.json({
                    days,
                    total_runs: cachedStats.total_runs,
                    tasks_played: cachedStats.unique_tasks,
                    avg_accuracy: cachedStats.avg_accuracy,
                    best_task: cachedStats.best_task_name ? {
                        task_name: cachedStats.best_task_name,
                        avg_accuracy: cachedStats.best_task_accuracy
                    } : null
                });
            }

            // Fallback to original calculation for custom periods
            const since = daysAgoIso(days);

            const totals = await db.get(
                `SELECT COUNT(*) AS total_runs,
                COUNT(DISTINCT task_id) AS tasks_played,
                ROUND(AVG(accuracy), 2) AS avg_accuracy
         FROM runs
         WHERE datetime(played_at) >= datetime(?) AND is_practice = 0`,
                [since]
            );

            const bestTask = await db.get(
                `SELECT t.name AS task_name,
                ROUND(AVG(r.accuracy), 2) AS avg_accuracy,
                COUNT(r.id) AS runs
         FROM runs r
         JOIN tasks t ON r.id = r.task_id
         WHERE datetime(r.played_at) >= datetime(?) AND r.is_practice = 0
         GROUP BY t.id
         HAVING runs >= 5
         ORDER BY avg_accuracy DESC
         LIMIT 1`,
                [since]
            );

            res.json({
                days,
                ...totals,
                best_task: bestTask || null
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'summary failed' });
        }
    });

    // KPIs for last 7 days - using cache
    router.get('/kpis/7d', async (_req, res) => {
        try {
            const cachedStats = await cacheManager.getTimeStats('7days');
            
            if (cachedStats) {
                return res.json({
                    total_runs: cachedStats.total_runs,
                    avg_accuracy: cachedStats.avg_accuracy,
                    unique_tasks: cachedStats.unique_tasks
                });
            }

            // Fallback calculation
            const since = daysAgoIso(7);
            const stats = await db.get(
                `SELECT COUNT(*) as total_runs,
                COUNT(DISTINCT task_id) as unique_tasks,
                ROUND(AVG(accuracy), 2) as avg_accuracy
         FROM runs
         WHERE datetime(played_at) >= datetime(?) AND is_practice = 0`,
                [since]
            );

            res.json(stats);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'kpis failed' });
        }
    });

    return router;
};
