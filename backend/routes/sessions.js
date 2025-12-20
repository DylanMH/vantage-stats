// backend/routes/sessions.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Start a new training session
    router.post('/start', async (req, res) => {
        try {
            const { name, notes } = req.body;
            const startedAt = new Date().toISOString();

            const existing = await db.get('SELECT id FROM sessions WHERE is_active = 1');
            if (existing) {
                return res.status(400).json({ error: 'A session is already active. End it before starting a new one.' });
            }

            // Check if practice mode is active
            const { getSettingBoolean } = require('../settings');
            const isPracticeMode = await getSettingBoolean(db, 'practice_mode_active', false);

            const result = await db.run(`
                INSERT INTO sessions (name, notes, started_at, is_active, is_practice)
                VALUES (?, ?, ?, 1, ?)
            `, [name || null, notes || null, startedAt, isPracticeMode ? 1 : 0]);

            const session = await db.get('SELECT * FROM sessions WHERE id = ?', [result.lastID]);
            
            if (isPracticeMode) {
                console.log('🎯 Practice session started');
            }
            
            res.json(session);
        } catch (e) {
            console.error('Error starting session:', e);
            res.status(500).json({ error: 'Failed to start session' });
        }
    });

    // End an active session
    router.post('/:id/end', async (req, res) => {
        try {
            const { id } = req.params;
            const endedAt = new Date().toISOString();

            const session = await db.get('SELECT * FROM sessions WHERE id = ? AND is_active = 1', [id]);
            if (!session) {
                return res.status(404).json({ error: 'Active session not found' });
            }

            const isPractice = session.is_practice || 0;

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_runs,
                    SUM(duration) as total_duration
                FROM runs
                WHERE played_at >= ?
                    AND played_at <= ?
                    AND is_practice = ?
            `, [session.started_at, endedAt, isPractice]);

            await db.run(`
                UPDATE sessions 
                SET ended_at = ?,
                    is_active = 0,
                    total_runs = ?,
                    total_duration = ?
                WHERE id = ?
            `, [endedAt, stats.total_runs || 0, stats.total_duration || 0, id]);

            const updated = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
            
            if (isPractice) {
                console.log('🎯 Practice session ended');
            }
            
            res.json(updated);
        } catch (e) {
            console.error('Error ending session:', e);
            res.status(500).json({ error: 'Failed to end session' });
        }
    });

    // Get all sessions
    router.get('/', async (req, res) => {
        try {
            const { active } = req.query;
            const params = [];

            const where = [];
            if (active === 'true') {
                where.push('s.is_active = 1');
            }

            const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const endTimeExpr = `COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
            const wallClockSecondsExpr = `MAX(0, CAST((julianday(${endTimeExpr}) - julianday(s.started_at)) * 86400 AS INTEGER))`;

            const sessions = await db.all(
                `SELECT
                    s.*,
                    (
                        SELECT COUNT(*)
                        FROM runs r
                        WHERE r.played_at >= s.started_at
                          AND r.played_at <= ${endTimeExpr}
                          AND r.is_practice = COALESCE(s.is_practice, 0)
                    ) as total_runs,
                    (
                        SELECT
                          CASE
                            WHEN COALESCE(SUM(r.duration), 0) > ${wallClockSecondsExpr} THEN ${wallClockSecondsExpr}
                            ELSE COALESCE(SUM(r.duration), 0)
                          END
                        FROM runs r
                        WHERE r.played_at >= s.started_at
                          AND r.played_at <= ${endTimeExpr}
                          AND r.is_practice = COALESCE(s.is_practice, 0)
                    ) as total_duration
                FROM sessions s
                ${whereClause}
                ORDER BY s.started_at DESC`,
                params
            );
            res.json(sessions);
        } catch (e) {
            console.error('Error fetching sessions:', e);
            res.status(500).json({ error: 'Failed to fetch sessions' });
        }
    });

    // Get session details
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const session = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const endTime = session.ended_at || new Date().toISOString();
            const isPractice = session.is_practice || 0;
            
            const runs = await db.all(`
                SELECT 
                    r.*,
                    t.name as task_name
                FROM runs r
                JOIN tasks t ON t.id = r.task_id
                WHERE r.played_at >= ?
                    AND r.played_at <= ?
                    AND r.is_practice = ?
                ORDER BY r.played_at DESC
            `, [session.started_at, endTime, isPractice]);

            const stats = await db.get(
                `SELECT
                    COUNT(*) as total_runs,
                    COALESCE(SUM(duration), 0) as total_duration
                FROM runs
                WHERE played_at >= ?
                  AND played_at <= ?
                  AND is_practice = ?`,
                [session.started_at, endTime, isPractice]
            );

            const wallClockSeconds = Math.max(
                0,
                Math.floor((new Date(endTime).getTime() - new Date(session.started_at).getTime()) / 1000)
            );

            const clampedStats = {
                ...stats,
                total_duration: Math.min(Number(stats?.total_duration ?? 0), wallClockSeconds)
            };

            res.json({ ...session, ...clampedStats, runs });
        } catch (e) {
            console.error('Error fetching session:', e);
            res.status(500).json({ error: 'Failed to fetch session details' });
        }
    });

    // Update session
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, notes } = req.body;

            await db.run(
                `UPDATE sessions SET name = ?, notes = ? WHERE id = ?`,
                [name || null, notes || null, id]
            );

            const updated = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
            res.json(updated);
        } catch (e) {
            console.error('Error updating session:', e);
            res.status(500).json({ error: 'Failed to update session' });
        }
    });

    // Delete session
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await db.run('DELETE FROM sessions WHERE id = ?', [id]);
            res.json({ success: true, deletedSessionId: id });
        } catch (e) {
            console.error('Error deleting session:', e);
            res.status(500).json({ error: 'Failed to delete session' });
        }
    });

    return router;
};
