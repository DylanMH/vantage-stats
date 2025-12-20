// backend/routes/summary.js
const express = require('express');
const router = express.Router();
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    // Global summary (for Home cards)
    router.get('/', async (req, res) => {
        try {
            const days = Number(req.query.days ?? 7);
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
         JOIN tasks t ON t.id = r.task_id
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

    // KPIs for last 7 days
    router.get('/kpis/7d', async (_req, res) => {
        try {
            const since = daysAgoIso(7);

            const kpis = await db.get(
                `SELECT COUNT(*) AS runs7d,
                COUNT(DISTINCT task_id) AS tasks7d,
                ROUND(AVG(accuracy), 2) AS avgAcc7d
         FROM runs
         WHERE datetime(played_at) >= datetime(?) AND is_practice = 0`,
                [since]
            );

            res.json(kpis);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'kpis failed' });
        }
    });

    return router;
};
