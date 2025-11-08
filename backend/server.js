// backend/server.js
const express = require('express');
const path = require('path');
const goals = require('./goals');
const packs = require('./packs');
const settings = require('./settings');
const { scanAllCsvs } = require('./watcher');

function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

// Store SSE clients for real-time updates
let sseClients = [];

function notifyNewRun() {
    // Notify all connected clients that new data is available
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'new-run' })}\n\n`);
    });
}

function startServer(db, port = 3000) {
    const app = express();
    
    // Enable CORS for development (allows Vite dev server on port 5173 to access API)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });
    
    app.use(express.json());

    // SSE endpoint for real-time updates
    app.get('/api/events', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

        // Add client to list
        sseClients.push(res);

        // Remove client on disconnect
        req.on('close', () => {
            sseClients = sseClients.filter(client => client !== res);
        });
    });

    // serve static dashboard from /public
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Root quick doc
    app.get('/api', (_req, res) => {
        res.type('text').send(
            `Kovaaks Insight API - All Endpoints:\n\n` +
            `Raw Runs:\n` +
            `  GET /api/runs - Get all runs\n` +
            `  GET /api/runs?task=<name> - Filter by task name\n` +
            `  GET /api/runs?days=30&limit=100 - Filter by timeframe and limit\n\n` +
            `Tasks:\n` +
            `  GET /api/tasks - Get all tasks\n` +
            `  GET /api/tasks/names - Get unique task names (for filters)\n` +
            `  GET /api/tasks/names?pack_id=<id> - Task names filtered by pack\n` +
            `  GET /api/tasks/summary - Aggregated task statistics\n` +
            `  GET /api/tasks/summary?pack_id=<id>&limit=50 - Task summary by pack\n\n` +
            `Statistics:\n` +
            `  GET /api/stats/global - Global statistics overview\n` +
            `  GET /api/stats/global?days=30 - Global stats for timeframe\n` +
            `  GET /api/stats/global?pack_id=<id>&task=<name> - Filtered stats\n` +
            `  GET /api/kpis/7d - KPIs for last 7 days\n` +
            `  GET /api/summary?days=7 - Summary for timeframe\n\n` +
            `User & Goals:\n` +
            `  GET /api/user/profile - User profile with stats\n` +
            `  GET /api/goals?active=true&limit=3 - Active goals\n` +
            `  GET /api/goals?completed=true - Completed goals\n\n` +
            `Packs:\n` +
            `  GET /api/packs - Get all packs\n` +
            `  POST /api/packs - Create new pack\n`
        );
    });

    // Raw runs, optional task + days filters
    app.get('/api/runs', async (req, res) => {
        try {
            const { task, days, limit } = req.query;
            const params = [];
            const where = [];

            if (task) {
                where.push('t.name = ?');
                params.push(task);
            }
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    // For "day" filter, use today from midnight (not last 24 hours)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    where.push('datetime(r.played_at) >= datetime(?)');
                    params.push(today.toISOString());
                } else {
                    // For week/month, use X days ago
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
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
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

    // Global statistics overview
    app.get('/api/stats/global', async (req, res) => {
        try {
            const { days, pack_id, task } = req.query;
            const params = [];
            const whereConditions = [];
            
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    // For "day" filter, use today from midnight
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
            
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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
    app.get('/api/tasks', async (_req, res) => {
        try {
            const rows = await db.all(`
        SELECT
          t.id AS task_id,
          t.name AS task_name,
          COUNT(r.id) AS runs,
          ROUND(AVG(r.accuracy), 2) AS avg_accuracy,
          ROUND(AVG(r.score), 2) AS avg_score,
          MAX(r.played_at) AS last_played
        FROM tasks t
        LEFT JOIN runs r ON r.task_id = t.id
        GROUP BY t.id
        ORDER BY last_played DESC NULLS LAST, runs DESC
      `);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'query failed' });
        }
    });

    // Global summary (for Home cards)
    app.get('/api/summary', async (req, res) => {
        try {
            const days = Number(req.query.days ?? 7);
            const since = daysAgoIso(days);

            const totals = await db.get(
                `SELECT COUNT(*) AS total_runs,
                COUNT(DISTINCT task_id) AS tasks_played,
                ROUND(AVG(accuracy), 2) AS avg_accuracy
         FROM runs
         WHERE datetime(played_at) >= datetime(?)`,
                [since]
            );

            const bestTask = await db.get(
                `SELECT t.name AS task_name,
                ROUND(AVG(r.accuracy), 2) AS avg_accuracy,
                COUNT(r.id) AS runs
         FROM runs r
         JOIN tasks t ON t.id = r.task_id
         WHERE datetime(r.played_at) >= datetime(?)
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

    // KPIs for last 7 days (for dashboard cards)
    app.get('/api/kpis/7d', async (_req, res) => {
        try {
            const since = daysAgoIso(7);

            const kpis = await db.get(
                `SELECT COUNT(*) AS runs7d,
                COUNT(DISTINCT task_id) AS tasks7d,
                ROUND(AVG(accuracy), 2) AS avgAcc7d
         FROM runs
         WHERE datetime(played_at) >= datetime(?)`,
                [since]
            );

            res.json(kpis);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'kpis failed' });
        }
    });

    // Get unique task names for filters
    app.get('/api/tasks/names', async (req, res) => {
        try {
            const { pack_id } = req.query;
            let sql;
            let params = [];
            
            if (pack_id) {
                sql = `
                    SELECT DISTINCT t.name
                    FROM tasks t
                    INNER JOIN pack_tasks pt ON t.id = pt.task_id
                    INNER JOIN runs r ON r.task_id = t.id
                    WHERE pt.pack_id = ?
                    ORDER BY t.name
                `;
                params = [pack_id];
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
    app.get('/api/tasks/summary', async (req, res) => {
        try {
            const { pack_id, days, limit = 50 } = req.query;
            
            // Build time filter
            let timeFilter = '';
            const params = [];
            
            if (days) {
                const numDays = Number(days);
                if (numDays === 1) {
                    // Today from midnight
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    timeFilter = 'AND datetime(r.played_at) >= datetime(?)';
                    params.push(today.toISOString());
                } else {
                    // X days ago
                    timeFilter = 'AND datetime(r.played_at) >= datetime(?)';
                    params.push(daysAgoIso(numDays));
                }
            }
            
            let sql;
            
            if (pack_id) {
                // Filter tasks by pack
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
                    LEFT JOIN runs r ON r.task_id = t.id
                    WHERE pt.pack_id = ? ${timeFilter}
                    GROUP BY t.id
                    HAVING runs > 0
                    ORDER BY last_played DESC NULLS LAST, runs DESC
                    LIMIT ?
                `;
                const rows = await db.all(sql, [pack_id, ...params, Number(limit)]);
                res.json(rows);
            } else {
                // Show all tasks with actual runs
                const whereClause = timeFilter ? `WHERE ${timeFilter.replace('AND ', '')}` : '';
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

    // Overall performance history (all tasks over time)
    app.get('/api/stats/history', async (req, res) => {
        try {
            const { days, limit = 1000, pack_id } = req.query;
            
            let whereConditions = [];
            const params = [];
            
            if (days) {
                const numDays = parseInt(days);
                if (numDays === 1) {
                    // For "day" filter, use today from midnight
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(today.toISOString());
                } else {
                    // For week/month, use X days ago
                    whereConditions.push('datetime(r.played_at) >= datetime(?)');
                    params.push(daysAgoIso(numDays));
                }
            }
            
            if (pack_id) {
                whereConditions.push(`t.id IN (SELECT task_id FROM pack_tasks WHERE pack_id = ?)`);
                params.push(parseInt(pack_id));
            }
            
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            
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

    // Best sensitivity settings for a task (based on filter criteria)
    app.get('/api/tasks/:taskName/best-settings', async (req, res) => {
        try {
            const { taskName } = req.params;
            const { filterBy = 'score' } = req.query; // score, accuracy, or ttk
            
            // Determine ORDER BY clause and column based on filter
            let orderBy, whereColumn;
            if (filterBy === 'accuracy') {
                orderBy = 'r.accuracy DESC';
                whereColumn = 'r.accuracy';
            } else if (filterBy === 'ttk') {
                orderBy = 'r.avg_ttk ASC'; // Lower TTK is better
                whereColumn = 'r.avg_ttk';
            } else {
                orderBy = 'r.score DESC';
                whereColumn = 'r.score';
            }
            
            // Find the best run for this task based on filter
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
                return res.json(null);
            }
            
            res.json(bestRun);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'best settings lookup failed' });
        }
    });

    // Get runs for a specific day (for day-to-day comparison)
    app.get('/api/runs/by-day', async (req, res) => {
        try {
            const { day } = req.query; // 'today' or 'yesterday'
            
            let targetDate;
            const now = new Date();
            
            if (day === 'today') {
                // Get today's date in YYYY-MM-DD format
                targetDate = now.toISOString().split('T')[0];
            } else if (day === 'yesterday') {
                // Get yesterday's date in YYYY-MM-DD format
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                targetDate = yesterday.toISOString().split('T')[0];
            } else {
                return res.status(400).json({ error: 'Invalid day parameter. Use "today" or "yesterday"' });
            }
            
            console.log(`📊 Fetching runs for ${day} (${targetDate})`);
            
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
                WHERE DATE(r.played_at) = ?
                ORDER BY r.played_at DESC
            `, [targetDate]);
            
            console.log(`   Found ${runs.length} runs for ${targetDate}`);
            
            res.json(runs);
        } catch (e) {
            console.error('Error fetching runs by day:', e);
            res.status(500).json({ error: 'Failed to fetch runs by day' });
        }
    });

    // User profile
    app.get('/api/user/profile', async (_req, res) => {
        try {
            let user = await db.get(`SELECT * FROM users WHERE id = 1`);
            
            if (!user) {
                await db.run(`INSERT INTO users (id, username) VALUES (1, 'Player')`);
                user = await db.get(`SELECT * FROM users WHERE id = 1`);
            }

            // Get actual stats from runs table
            const totalStats = await db.get(`
                SELECT 
                    COUNT(*) as total_runs, 
                    COUNT(DISTINCT task_id) as unique_tasks,
                    SUM(duration) as total_playtime
                FROM runs
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
            res.status(500).json({ error: 'user profile failed' });
        }
    });

    // Goals endpoints
    app.get('/api/goals', async (req, res) => {
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
                    t.name as target_task_name
                FROM goals g
                LEFT JOIN goal_progress gp ON g.id = gp.goal_id
                LEFT JOIN tasks t ON g.target_task_id = t.id
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

    // Clean up duplicate goals (keeps only the most recent of each type)
    app.post('/api/goals/cleanup-duplicates', async (req, res) => {
        try {
            // Find duplicate goal types
            const duplicates = await db.all(`
                SELECT goal_type, COUNT(*) as count
                FROM goals
                WHERE is_active = 1
                GROUP BY goal_type
                HAVING count > 1
            `);

            let removed = 0;
            
            for (const dup of duplicates) {
                // Get all goals of this type, ordered by creation date
                const goals = await db.all(`
                    SELECT id, created_at
                    FROM goals
                    WHERE goal_type = ? AND is_active = 1
                    ORDER BY created_at DESC
                `, [dup.goal_type]);

                // Keep the newest, delete the rest
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

    // Test endpoint to simulate goal achievement (development only)
    app.post('/api/goals/test-achievement', async (req, res) => {
        try {
            // Get first active goal
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

            // First, reset the goal (mark as incomplete)
            await db.run(`
                UPDATE goal_progress 
                SET is_completed = 0, completed_at = NULL
                WHERE goal_id = ?
            `, [goal.id]);

            // Wait a tiny bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 100));

            // Now mark it as completed with current timestamp
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

    // Check for newly achieved goals (for notifications)
    app.get('/api/goals/check-achievements', async (req, res) => {
        try {
            const { since } = req.query; // Timestamp to check from
            
            // Get goals that were recently completed
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
                ${since ? "AND gp.completed_at > datetime(?)" : ""}
                ORDER BY gp.completed_at DESC
                LIMIT 10
            `, since ? [since] : []);

            res.json({ achievements: recentlyCompleted });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'check achievements failed' });
        }
    });

    // Packs endpoints
    app.get('/api/packs', async (_req, res) => {
        try {
            const rows = await db.all(`
                SELECT 
                    p.*,
                    COUNT(pt.task_id) as task_count
                FROM packs p
                LEFT JOIN pack_tasks pt ON p.id = pt.pack_id
                GROUP BY p.id
                ORDER BY p.name
            `);
            res.json(rows);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'packs query failed' });
        }
    });

    // Create a new pack
    app.post('/api/packs', async (req, res) => {
        try {
            const { name, description, game_focus, tasks } = req.body;
            
            if (!name || !Array.isArray(tasks) || tasks.length === 0) {
                return res.status(400).json({ error: 'Pack name and tasks array are required' });
            }

            // Create the pack
            const result = await db.run(`
                INSERT INTO packs (name, description, game_focus, is_public)
                VALUES (?, ?, ?, 0)
            `, [name, description || '', game_focus || 'Custom']);

            const packId = result.lastID;

            // Add tasks to the pack
            for (const taskName of tasks) {
                // Ensure task exists
                await db.run(`INSERT OR IGNORE INTO tasks (name) VALUES (?)`, [taskName]);
                const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);
                
                if (task) {
                    await db.run(`INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`, [packId, task.id]);
                }
            }

            res.json({ id: packId, name, description, game_focus, tasks });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'pack creation failed' });
        }
    });

    // Delete a pack
    app.delete('/api/packs/:id', async (req, res) => {
        try {
            const packId = req.params.id;
            
            // Delete pack tasks first (foreign key)
            await db.run(`DELETE FROM pack_tasks WHERE pack_id = ?`, [packId]);
            
            // Delete the pack
            const result = await db.run(`DELETE FROM packs WHERE id = ?`, [packId]);
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Pack not found' });
            }
            
            res.json({ success: true, message: 'Pack deleted successfully' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'pack deletion failed' });
        }
    });

    // Get pack details with tasks
    app.get('/api/packs/:id/tasks', async (req, res) => {
        try {
            const packId = req.params.id;
            const pack = await db.get(`SELECT * FROM packs WHERE id = ?`, [packId]);
            
            if (!pack) {
                return res.status(404).json({ error: 'Pack not found' });
            }

            const packTasks = await packs.getPackTasks(db, packId);
            const packStats = await packs.getPackStats(db, packId);

            res.json({
                pack,
                tasks: packTasks,
                stats: packStats
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'pack details query failed' });
        }
    });

    // Settings endpoints
    app.get('/api/settings', async (_req, res) => {
        try {
            // Get username from users table (same as profile page)
            let user = await db.get(`SELECT username FROM users WHERE id = 1`);
            const username = user?.username || 'Player';
            
            const statsFolder = await settings.getSetting(db, 'stats_folder', '');
            const playlistsFolder = await settings.getSetting(db, 'playlists_folder', '');
            const theme = await settings.getSetting(db, 'theme', 'default');
            const autoGoals = await settings.getSettingBoolean(db, 'auto_goals', true);
            const notifications = await settings.getSettingBoolean(db, 'notifications', true);
            const darkMode = await settings.getSettingBoolean(db, 'dark_mode', true);
            
            res.json({
                username,
                statsFolder,
                playlistsFolder,
                theme,
                autoGoals,
                notifications,
                darkMode
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    });

    app.post('/api/settings', async (req, res) => {
        try {
            const { username, statsFolder, playlistsFolder, theme, autoGoals, notifications, darkMode } = req.body;
            
            if (username !== undefined) {
                // Update username in users table (used by profile page)
                await db.run(`
                    INSERT INTO users (id, username) VALUES (1, ?)
                    ON CONFLICT(id) DO UPDATE SET username = ?
                `, [username, username]);
            }
            if (statsFolder !== undefined) {
                await settings.setSetting(db, 'stats_folder', statsFolder);
            }
            if (playlistsFolder !== undefined) {
                await settings.setSetting(db, 'playlists_folder', playlistsFolder);
            }
            if (theme !== undefined) {
                await settings.setSetting(db, 'theme', theme);
            }
            if (autoGoals !== undefined) {
                await settings.setSetting(db, 'auto_goals', autoGoals ? 'true' : 'false');
            }
            if (notifications !== undefined) {
                await settings.setSetting(db, 'notifications', notifications ? 'true' : 'false');
            }
            if (darkMode !== undefined) {
                await settings.setSetting(db, 'dark_mode', darkMode ? 'true' : 'false');
            }
            
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

    app.post('/api/settings/clear-data', async (_req, res) => {
        try {
            // Clear all data from database
            await db.run('DELETE FROM runs');
            await db.run('DELETE FROM tasks');
            await db.run('DELETE FROM goals');
            await db.run('DELETE FROM packs');
            await db.run('DELETE FROM pack_tasks');
            
            res.json({ success: true, message: 'All data cleared successfully' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to clear data' });
        }
    });

    app.post('/api/settings/rescan', async (_req, res) => {
        try {
            const statsFolder = await settings.getSetting(db, 'stats_folder', '');
            
            if (!statsFolder) {
                return res.status(400).json({ error: 'Stats folder not configured' });
            }

            console.log('🔄 Starting manual rescan of:', statsFolder);
            const result = await scanAllCsvs(statsFolder, db);
            console.log(`✅ Rescan complete: ${result.newFiles} new, ${result.duplicates} duplicates`);
            
            res.json({ 
                success: true, 
                message: `Scan complete: ${result.newFiles} new runs imported, ${result.duplicates} duplicates skipped`,
                newFiles: result.newFiles,
                duplicates: result.duplicates,
                total: result.total
            });
        } catch (e) {
            console.error('Rescan error:', e);
            res.status(500).json({ error: 'Failed to rescan folder: ' + e.message });
        }
    });

    // Initialize default packs and check for goal generation on startup
    app.listen(port, async () => {
        console.log(`server on http://localhost:${port}`);
        
        // Check for goal generation
        console.log('Checking for automatic goal generation...');
        await goals.generateGoals(db);
    });
}

// Helper function to initialize stats folder setting from config
async function initializeStatsFolder(db, statsPath) {
    const { setSetting } = require('./settings');
    await setSetting(db, 'stats_folder', statsPath);
    console.log(`📁 Stats folder initialized: ${statsPath}`);
}

module.exports = { startServer, initializeStatsFolder, notifyNewRun };
