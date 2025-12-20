// backend/routes/runs.js
const express = require('express');
const router = express.Router();
const { daysAgoIso } = require('../utils/time');

module.exports = (db) => {
    // Get runs with optional filters (task, days, limit)
    router.get('/', async (req, res) => {
        try {
            const { task, days, limit } = req.query;
            const params = [];
            const where = ['r.is_practice = 0'];

            if (task) {
                where.push('t.name = ?');
                params.push(task);
            }
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    where.push('datetime(r.played_at) >= datetime(?)');
                    params.push(today.toISOString());
                } else {
                    where.push('datetime(r.played_at) >= datetime(?)');
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
        WHERE ${where.join(' AND ')}
        ORDER BY datetime(r.played_at) DESC
        ${limitClause}
      `;
            const rows = await db.all(sql, params);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'query failed' });
        }
    });

    // Get runs for a specific day
    router.get('/by-day', async (req, res) => {
        try {
            const { day } = req.query;
            
            let targetDate;
            if (day === 'today') {
                targetDate = new Date();
            } else if (day === 'yesterday') {
                targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - 1);
            } else {
                return res.status(400).json({ error: 'Invalid day parameter. Use "today" or "yesterday".' });
            }
            
            // Get timezone offset in minutes and convert to SQLite modifier format
            const offsetMinutes = targetDate.getTimezoneOffset();
            const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
            const offsetMins = Math.abs(offsetMinutes) % 60;
            const offsetSign = offsetMinutes > 0 ? '-' : '+'; // Inverted because getTimezoneOffset returns positive for behind UTC
            const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
            
            // Use local date format (YYYY-MM-DD)
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dayOfMonth = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayOfMonth}`;
            
            // Convert UTC timestamps to local time before extracting date
            const runs = await db.all(`
                SELECT 
                    r.id,
                    r.score,
                    r.accuracy,
                    r.avg_ttk,
                    r.shots,
                    r.hits,
                    r.duration,
                    r.played_at,
                    t.name AS task_name
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                WHERE DATE(datetime(r.played_at, ?)) = ?
                  AND r.is_practice = 0
                ORDER BY r.played_at DESC
            `, [offsetStr, dateStr]);
            
            res.json(runs);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch runs by day' });
        }
    });

    // Backfill duration for runs
    router.post('/backfill-duration', async (req, res) => {
        const { parseCsvToRun } = require('../core/data-import/csvParser');
        const fs = require('fs');
        
        try {
            const limit = req.body?.limit != null ? Number(req.body.limit) : null;
            const onlyNull = req.body?.onlyNull === true;
            
            const where = ['path IS NOT NULL', "TRIM(path) <> ''"];
            if (onlyNull) {
                where.push('duration IS NULL');
            }
            
            const sql = `SELECT id, path, score FROM runs WHERE ${where.join(' AND ')} ORDER BY id ASC${limit ? ' LIMIT ?' : ''}`;
            const rows = await db.all(sql, limit ? [limit] : []);
            
            let updated = 0;
            let skippedMissingFile = 0;
            let skippedNoDuration = 0;
            let errors = 0;
            
            for (const row of rows) {
                try {
                    if (!fs.existsSync(row.path)) {
                        skippedMissingFile++;
                        continue;
                    }
                    
                    const parsed = parseCsvToRun(row.path);
                    const duration = parsed?.duration;
                    if (duration == null || !Number.isFinite(duration) || duration <= 0) {
                        skippedNoDuration++;
                        continue;
                    }
                    
                    const score = parsed?.score != null ? parsed.score : row.score;
                    const scorePerMin = (score != null && duration > 0) ? score / (duration / 60) : null;
                    
                    await db.run(
                        `UPDATE runs SET duration = ?, score_per_min = ? WHERE id = ?`,
                        [duration, scorePerMin, row.id]
                    );
                    updated++;
                } catch {
                    errors++;
                }
            }
            
            res.json({
                success: true,
                total: rows.length,
                updated,
                skippedMissingFile,
                skippedNoDuration,
                errors
            });
        } catch (e) {
            console.error('Backfill duration error:', e);
            res.status(500).json({ error: 'Backfill failed' });
        }
    });

    return router;
};
