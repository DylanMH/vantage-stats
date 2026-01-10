// backend/config/server.js
// Main Express API server for Vantage Stats
const express = require('express');
const path = require('path');
const events = require('../utils/events');
const goals = require('../core/goals/goals');
const { initializeCache } = require('./cacheInitializer');

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

    // Serve static files from public directory with cache headers
    app.use(express.static(path.join(__dirname, '..', 'public'), {
        maxAge: '1y', // Cache static assets for 1 year
        setHeaders: (res, filePath) => {
            // Set cache control based on file type
            if (filePath.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i)) {
                // Images: cache for 1 year (immutable)
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else if (filePath.match(/\.(css|js)$/i)) {
                // CSS/JS: cache for 1 year
                res.setHeader('Cache-Control', 'public, max-age=31536000');
            } else if (filePath.match(/\.(woff|woff2|ttf|eot)$/i)) {
                // Fonts: cache for 1 year
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

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
            `Playlists:\n` +
            `  GET /api/playlists - Get all playlists\n` +
            `  GET /api/playlists/:id/tasks - Get playlist tasks\n` +
            `  GET /api/playlists/:id/stats - Get playlist stats\n` +
            `  POST /api/playlists - Create playlist (in database)\n` +
            `  POST /api/playlists/create - Export playlist JSON file\n` +
            `  DELETE /api/playlists/:id - Delete playlist\n\n` +
            `Settings:\n` +
            `  GET /api/settings - Get settings\n` +
            `  POST /api/settings - Update settings\n` +
            `  POST /api/settings/clear-data - Clear all data\n` +
            `  POST /api/settings/rescan - Rescan stats folder\n\n` +
            `User:\n` +
            `  GET /api/user/profile - Get user profile\n\n` +
            `Ranked:\n` +
            `  GET /api/ranked/stats - Get complete ranked stats\n` +
            `  GET /api/ranked/category/:category - Get category details\n` +
            `  GET /api/ranked/tasks - Get all ranked tasks\n` +
            `  POST /api/ranked/calculate-percentile - Calculate percentile for score\n`
        );
    });

    // ===========================================
    // MOUNT ROUTE MODULES
    // ===========================================
    
    const runsRoutes = require('../routes/runs')(db);
    const statsRoutes = require('../routes/stats')(db);
    const tasksRoutes = require('../routes/tasks')(db);
    const practiceRoutes = require('../routes/practice')(db);
    const goalsRoutes = require('../routes/goals')(db);
    const sessionsRoutes = require('../routes/sessions')(db);
    const settingsRoutes = require('../routes/settings')(db);
    const userRoutes = require('../routes/user')(db);
    const summaryRoutes = require('../routes/summary')(db);
    const comparisonsRoutes = require('../routes/comparisons')(db);
    const rankedRoutes = require('../routes/ranked')(db);
    const playlistsRoutes = require('../routes/playlists');
    const exportRoutes = require('../routes/export');

    app.set('db', db);

    // Middleware to attach db to requests for export routes
    app.use((req, res, next) => {
        req.db = db;
        next();
    });

    app.use('/api/runs', runsRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/tasks', tasksRoutes);
    app.use('/api/practice', practiceRoutes);
    app.use('/api/goals', goalsRoutes);
    app.use('/api/sessions', sessionsRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/summary', summaryRoutes);
    app.use('/api/comparisons', comparisonsRoutes);
    app.use('/api/ranked', rankedRoutes);
    app.use('/api/export', exportRoutes);
    app.use('/api/playlists', playlistsRoutes);

    // Initialize default packs and check for goal generation on startup
    app.listen(port, async () => {
        console.log(`server on http://localhost:${port}`);
        
        // Initialize performance cache
        await initializeCache(db);
        
        // Check for goal generation
        console.log('Checking for automatic goal generation...');
        await goals.generateGoals(db);
    });
}

module.exports = { startServer, initializeStatsFolder };
