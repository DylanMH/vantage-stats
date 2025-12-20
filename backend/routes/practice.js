// backend/routes/practice.js
const express = require('express');
const router = express.Router();
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    /**
     * Get practice mode status
     */
    router.get('/status', async (_req, res) => {
        try {
            const { getSetting } = require('../services/settings');
            const isPracticeMode = await getSetting(db, 'practice_mode_active', 'false');
            res.json({ isPracticeMode: isPracticeMode === 'true' || isPracticeMode === '1' });
        } catch (e) {
            console.error('Error fetching practice mode status:', e);
            res.status(500).json({ error: 'Failed to fetch practice mode status' });
        }
    });

    /**
     * Toggle practice mode on/off
     */
    router.post('/toggle', async (req, res) => {
        try {
            const { enabled } = req.body;
            
            // Check if there's an active session
            const activeSession = await db.get('SELECT id, name FROM sessions WHERE is_active = 1');
            if (activeSession) {
                return res.status(400).json({ 
                    error: 'Cannot toggle practice mode while a session is active. End the session first.',
                    activeSession: {
                        id: activeSession.id,
                        name: activeSession.name
                    }
                });
            }
            
            const value = enabled ? '1' : '0';
            
            await db.run(
                `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
                ['practice_mode_active', value]
            );
            
            console.log(`🎯 Practice mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
            res.json({ isPracticeMode: enabled });
        } catch (e) {
            console.error('Error toggling practice mode:', e);
            res.status(500).json({ error: 'Failed to toggle practice mode' });
        }
    });

    /**
     * Get practice mode statistics
     */
    router.get('/stats', async (req, res) => {
        try {
            const { days, pack_id, task } = req.query;
            const params = ['1'];
            const whereConditions = ['r.is_practice = ?'];
            
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
            
            let fromClause = 'FROM runs r LEFT JOIN tasks t ON t.id = r.task_id';
            if (pack_id) {
                fromClause += ' LEFT JOIN pack_tasks pt ON t.id = pt.task_id';
            }

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_runs,
                    COUNT(DISTINCT r.task_id) as unique_tasks,
                    CASE 
                        WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                        ELSE AVG(r.accuracy)
                    END as avg_accuracy,
                    AVG(r.score) as avg_score,
                    AVG(r.shots) as avg_shots,
                    SUM(r.shots) as total_shots,
                    AVG(r.duration) as avg_duration,
                    SUM(r.duration) as total_duration,
                    AVG(r.avg_ttk) as avg_ttk
                ${fromClause}
                ${whereClause}
            `, params);

            res.json(stats);
        } catch (e) {
            console.error('Error fetching practice stats:', e);
            res.status(500).json({ error: 'Failed to fetch practice stats' });
        }
    });

    /**
     * Get practice runs with filters
     */
    router.get('/runs', async (req, res) => {
        try {
            const { task, days, limit } = req.query;
            const params = ['1'];
            const whereConditions = ['r.is_practice = ?'];

            if (task) {
                whereConditions.push('t.name = ?');
                params.push(task);
            }
            
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

            const limitClause = limit ? `LIMIT ?` : 'LIMIT 1000';
            if (limit) params.push(Number(limit));

            const sql = `
                SELECT 
                    r.*,
                    t.name AS task_name,
                    CASE 
                        WHEN r.accuracy <= 1 THEN r.accuracy * 100
                        ELSE r.accuracy
                    END as accuracy
                FROM runs r
                LEFT JOIN tasks t ON t.id = r.task_id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY datetime(r.played_at) DESC
                ${limitClause}
            `;
            
            const rows = await db.all(sql, params);
            res.json(rows);
        } catch (e) {
            console.error('Error fetching practice runs:', e);
            res.status(500).json({ error: 'Failed to fetch practice runs' });
        }
    });

    /**
     * Get practice task summary
     */
    router.get('/tasks/summary', async (req, res) => {
        try {
            const { pack_id, days } = req.query;
            const params = ['1'];
            const whereConditions = ['r.is_practice = ?'];
            
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
            
            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
            
            let fromClause = 'FROM runs r LEFT JOIN tasks t ON t.id = r.task_id';
            if (pack_id) {
                fromClause += ' LEFT JOIN pack_tasks pt ON t.id = pt.task_id';
            }

            const summary = await db.all(`
                SELECT 
                    t.name as task_name,
                    COUNT(*) as runs,
                    CASE 
                        WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                        ELSE AVG(r.accuracy)
                    END as avg_accuracy,
                    AVG(r.score) as avg_score,
                    AVG(r.shots) as avg_shots,
                    AVG(r.hits) as avg_hits,
                    AVG(r.avg_ttk) as avg_ttk,
                    AVG(r.duration) as avg_duration,
                    AVG(r.overshots) as avg_overshots,
                    MAX(r.score) as max_score,
                    MAX(r.played_at) as last_played
                ${fromClause}
                ${whereClause}
                GROUP BY t.name
                ORDER BY last_played DESC
            `, params);

            res.json(summary);
        } catch (e) {
            console.error('Error fetching practice task summary:', e);
            res.status(500).json({ error: 'Failed to fetch practice task summary' });
        }
    });

    /**
     * Get practice performance history over time
     */
    router.get('/stats/history', async (req, res) => {
        try {
            const { days, limit = 1000, pack_id } = req.query;
            
            let whereConditions = ['r.is_practice = 1'];
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
            console.error('Error fetching practice history:', e);
            res.status(500).json({ error: 'Failed to fetch practice history' });
        }
    });

    return router;
};
