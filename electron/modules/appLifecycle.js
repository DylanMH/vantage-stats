// electron/modules/appLifecycle.js
// Application startup and initialization

const { app } = require('electron');
const { startServer } = require('../../backend/config/server');
const { importPlaylistsAsPacks } = require('../../backend/core/data-import/playlistImporter');
const { createWindow } = require('./windowManager');
const { setupAutoUpdates } = require('./autoUpdater');
const { setupDatabase, initializeDatabase } = require('./database');
const { initializeIpcHandlers } = require('./ipcHandlers');
const { isFirstRun, readConfig, getDataDirectory } = require('./dataLocation');

async function initializeApp() {
    // Check if this is first run (no data directory set)
    if (isFirstRun()) {
        console.log('🆕 First run - showing setup screen');
        // Show setup screen
        createWindow(true);
        
        // Initialize IPC handlers for setup (no database needed until save-config)
        initializeIpcHandlers(null);
        return;
    }

    // Load config from data directory (not AppData)
    const cfg = readConfig();
    
    if (!cfg || !cfg.stats_path) {
        console.log('⚠️  Config not found or incomplete - showing setup screen');
        createWindow(true);
        
        // Initialize IPC handlers for setup (no database needed until save-config)
        initializeIpcHandlers(null);
        return;
    }

    console.log('📋 Config loaded from:', getDataDirectory());
    console.log('   Stats folder:', cfg.stats_path);
    console.log('   Playlists folder:', cfg.playlists_path || 'Not set');
    console.log('   Auto-goals:', cfg.auto_goals);
    console.log('   Auto-import playlists:', cfg.auto_import_playlists);

    const isDev = process.env.NODE_ENV === 'development';
    
    // Setup database with custom data directory
    const db = setupDatabase(isDev, cfg.data_directory);
    
    // Initialize database
    await initializeDatabase(db, cfg);
    
    // Start backend API server
    startServer(db, cfg.port || 3000);

    console.log('⏳ Initializing data... Please wait...');
    
    // Wait for initial CSV scan to complete before showing UI
    const { startWatcher } = require('../../backend/core/data-import/watcher');
    const watcher = await startWatcher(cfg.stats_path, db);
    
    // Auto-import playlists if enabled
    if (cfg.auto_import_playlists && cfg.playlists_path) {
        console.log('🎵 Auto-importing playlists...');
        await importPlaylistsAsPacks(cfg.playlists_path, db);
    }
    
    console.log('✅ Data loaded! Launching interface...');
    
    // Show dashboard immediately after data is ready
    createWindow(false);

    // Auto-updater (GitHub releases) - packaged builds only
    setupAutoUpdates();
    
    // Initialize IPC handlers
    initializeIpcHandlers(db);
}

module.exports = { initializeApp };
