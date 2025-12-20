// backend/server.js
// Main Express API server for Vantage Stats
const express = require('express');
const path = require('path');
const events = require('./events');
const goals = require('./goals');

/**
 * Get ISO timestamp for X days ago
 */
function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

// ===========================================
// SSE (Server-Sent Events) for real-time updates
// ===========================================

let sseClients = [];

function broadcastSseEvent(payload) {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
}

/**
 * Initialize stats folder setting in database
 */
async function initializeStatsFolder(db, statsPath) {
    await db.run(`
        INSERT OR REPLACE INTO app_settings (key, value)
        VALUES ('stats_folder', ?)
    `, [statsPath]);
}

function startServer(db, port = 3000) {
    const app = express();

    // Subscribe once per server instance
    events.removeAllListeners('new-run');
    events.on('new-run', () => {
        broadcastSseEvent({ type: 'new-run' });
    });
    
    // Enable CORS for development
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
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
            'Connection': 'keep-alive'
        });
        sseClients.push(res);
        req.on('close', () => {
            sseClients = sseClients.filter(client => client !== res);
        });
    });

    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Root quick doc
    app.get('/api', (_req, res) => {
        res.type('text').send(
            `Vantage Stats API - All Endpoints:\n\n` +
            `Runs:\n` +
            `  GET /api/runs - Get runs with filters\n` +
            `  GET /api/runs/by-day - Get runs for a specific day\n` +
            `  POST /api/runs/backfill-duration - Backfill duration data\n\n` +
            `Statistics:\n` +
            `  GET /api/stats/global - Global statistics\n` +
            `  GET /api/stats/history - Performance history\n` +
            `  GET /api/summary - Global summary\n` +
            `  GET /api/summary/kpis/7d - KPIs for last 7 days\n\n` +
            `Tasks:\n` +
            `  GET /api/tasks - Get all tasks\n` +
            `  GET /api/tasks/names - Get task names\n` +
            `  GET /api/tasks/summary - Task performance summary\n` +
            `  GET /api/tasks/:taskName/best-settings - Best settings for task\n` +
            `  GET /api/tasks/:taskId/stats - Current stats for task\n\n` +
            `Practice Mode:\n` +
            `  GET /api/practice/status - Get practice mode status\n` +
            `  POST /api/practice/toggle - Toggle practice mode\n` +
            `  GET /api/practice/stats - Practice statistics\n` +
            `  GET /api/practice/runs - Practice runs\n` +
            `  GET /api/practice/tasks/summary - Practice task summary\n` +
            `  GET /api/practice/stats/history - Practice history\n\n` +
            `Goals:\n` +
            `  GET /api/goals - Get goals\n` +
            `  POST /api/goals/create - Create goal\n` +
            `  DELETE /api/goals/:id - Delete goal\n` +
            `  GET /api/goals/played-tasks - Get played tasks\n` +
            `  POST /api/goals/cleanup-duplicates - Clean up duplicates\n\n` +
            `Sessions:\n` +
            `  GET /api/sessions - Get all sessions\n` +
            `  GET /api/sessions/:id - Get session details\n` +
            `  POST /api/sessions/start - Start new session\n` +
            `  POST /api/sessions/:id/end - End session\n` +
            `  PUT /api/sessions/:id - Update session\n` +
            `  DELETE /api/sessions/:id - Delete session\n\n` +
            `Packs:\n` +
            `  GET /api/packs - Get all packs\n` +
            `  GET /api/packs/:id/tasks - Get pack tasks\n` +
            `  GET /api/packs/:packId/stats - Get pack stats\n` +
            `  POST /api/packs - Create pack\n` +
            `  DELETE /api/packs/:id - Delete pack\n\n` +
            `Settings:\n` +
            `  GET /api/settings - Get settings\n` +
            `  POST /api/settings - Update settings\n` +
            `  POST /api/settings/clear-data - Clear all data\n` +
            `  POST /api/settings/rescan - Rescan stats folder\n\n` +
            `User:\n` +
            `  GET /api/user/profile - Get user profile\n`
        );
    });

    // ===========================================
    // MOUNT ROUTE MODULES
    // ===========================================
    
    const runsRoutes = require('./routes/runs')(db);
    const statsRoutes = require('./routes/stats')(db);
    const tasksRoutes = require('./routes/tasks')(db);
    const practiceRoutes = require('./routes/practice')(db);
    const goalsRoutes = require('./routes/goals')(db);
    const sessionsRoutes = require('./routes/sessions')(db);
    const packsRoutes = require('./routes/packs')(db);
    const settingsRoutes = require('./routes/settings')(db);
    const userRoutes = require('./routes/user')(db);
    const summaryRoutes = require('./routes/summary')(db);
    const comparisonsRoutes = require('./routes/comparisons')(db);

    app.use('/api/runs', runsRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/tasks', tasksRoutes);
    app.use('/api/practice', practiceRoutes);
    app.use('/api/goals', goalsRoutes);
    app.use('/api/sessions', sessionsRoutes);
    app.use('/api/packs', packsRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/summary', summaryRoutes);
    app.use('/api/comparisons', comparisonsRoutes);

    // Initialize default packs and check for goal generation on startup
    app.listen(port, async () => {
        console.log(`server on http://localhost:${port}`);
        
        // Check for goal generation
        console.log('Checking for automatic goal generation...');
        await goals.generateGoals(db);
    });
}

module.exports = { startServer, initializeStatsFolder };
