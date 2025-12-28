// electron/main.js
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const path = require("path");
const fs = require("fs");
const { initDb } = require("../backend/config/database");
const { runMigrations } = require("../backend/config/migrationRunner");
const { startWatcher } = require("../backend/core/data-import/watcher");
const { startServer, initializeStatsFolder } = require("../backend/config/server");
const { importPlaylistsAsPacks } = require('../backend/core/data-import/playlistImporter');
const { parseCsvToRun } = require("../backend/core/data-import/csvParser");
const { getSetting, setSetting } = require("../backend/services/settings");

let mainWindow;
let watcher;
let db;

let mainWindowDidFinishLoad = false;
let pendingUpdateInfo = null;

let isAutoUpdaterInitialized = false;

async function showUpdatePrompt(info) {
    if (!mainWindow || !mainWindowDidFinishLoad) {
        pendingUpdateInfo = info;
        return;
    }

    try {
        // Extract release notes from info if available
        const releaseNotes = info.releaseNotes || 'No release notes available.';
        
        // Send to renderer for themed UI display
        mainWindow.webContents.send('update-available', {
            version: info.version,
            releaseNotes: typeof releaseNotes === 'string' ? releaseNotes : releaseNotes.join('\n'),
            releaseName: info.releaseName,
            releaseDate: info.releaseDate
        });
    } catch (e) {
        log.error('Failed to show update prompt:', e);
    }
}

function ensureAutoUpdaterInitialized() {
    // Only run updater in packaged builds (not during `npm start` dev).
    if (!app.isPackaged) {
        return false;
    }

    if (isAutoUpdaterInitialized) {
        return true;
    }

    // electron-updater will use the `publish` config from electron-builder (package.json)
    // and your `repository` URL to locate GitHub Releases.
    autoUpdater.autoDownload = false;
    autoUpdater.logger = log;
    log.transports.file.level = 'info';

    autoUpdater.on('error', (err) => {
        log.error('autoUpdater error:', err);
    });

    autoUpdater.on('update-available', async (info) => {
        await showUpdatePrompt(info);
    });

    autoUpdater.on('update-not-available', () => {
        log.info('No updates available');
    });

    autoUpdater.on('update-downloaded', () => {
        // User already opted-in, so apply immediately.
        log.info('Update downloaded; restarting to install...');
        autoUpdater.quitAndInstall(false, true);
    });

    isAutoUpdaterInitialized = true;
    return true;
}

async function setupAutoUpdates() {
    if (!ensureAutoUpdaterInitialized()) {
        return;
    }

    // Kick off the check
    try {
        await autoUpdater.checkForUpdates();
    } catch (e) {
        log.error('autoUpdater checkForUpdates failed:', e);
    }
}

async function runPlaytimeMigrationIfNeeded(dbInstance) {
    const migrationKey = 'playtime_migration_v2_done';
    const alreadyDone = await getSetting(dbInstance, migrationKey, 'false');
    if (alreadyDone === 'true' || alreadyDone === '1') {
        return;
    }

    console.log('⏳ Running one-time playtime migration (recalculating run durations from CSVs)...');

    const rows = await dbInstance.all(
        `SELECT id, path, score FROM runs WHERE path IS NOT NULL AND TRIM(path) <> '' ORDER BY id ASC`
    );

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

            await dbInstance.run(
                `UPDATE runs SET duration = ?, score_per_min = ? WHERE id = ?`,
                [duration, scorePerMin, row.id]
            );
            updated++;
        } catch {
            errors++;
        }
    }

    await setSetting(dbInstance, migrationKey, 'true');
    console.log(`✅ Playtime migration complete: updated ${updated}/${rows.length} runs (missing files: ${skippedMissingFile}, no duration: ${skippedNoDuration}, errors: ${errors})`);
}

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

// Check if we're in development mode (if frontend dev server is running)
const isDev = process.env.NODE_ENV === 'development' || fs.existsSync(path.join(__dirname, '../frontend/vite.config.ts'));

function createWindow(showSetup = false) {
    // Use the new Vantage Stats logo
    const iconPath = path.join(__dirname, '../assets/vs-icon-logo.png');

    mainWindow = new BrowserWindow({
        width: 900,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: 'Vantage Stats',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: iconPath,
    });

    mainWindowDidFinishLoad = false;
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindowDidFinishLoad = true;
        if (pendingUpdateInfo) {
            const info = pendingUpdateInfo;
            pendingUpdateInfo = null;
            showUpdatePrompt(info);
        }
    });

    if (showSetup) {
        // Load the setup page (basic HTML for folder selection)
        mainWindow.loadFile(path.join(__dirname, "index.html"));
    } else {
        // In development, load from Vite dev server; in production, load from built files
        if (isDev && fs.existsSync(path.join(__dirname, '../frontend'))) {
            mainWindow.loadURL('http://localhost:5173');
            // Open DevTools in development
            // mainWindow.webContents.openDevTools();
        } else {
            // Load from built files
            mainWindow.loadFile(path.join(__dirname, '../public/index.html'));
        }
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    const configPath = path.join(app.getPath("userData"), "config.json");
    let cfg = {};
    if (fs.existsSync(configPath)) {
        cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        console.log('📋 Config loaded:', {
            statsPath: cfg.stats_path,
            playlistsPath: cfg.playlists_path,
            autoGoals: cfg.auto_goals,
            autoImportPlaylists: cfg.auto_import_playlists
        });
    }

    // Database lives in userData directory (works in both dev and packaged app)
    // Dev and production use separate databases to avoid conflicts
    const userDataPath = app.getPath("userData");
    const dataDir = path.join(userDataPath, "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbFileName = isDev ? "vantage-dev.db" : "vantage.db";
    const backendDbPath = path.join(dataDir, dbFileName);
    
    // Migrate old database location to new folder structure (for existing users)
    const oldDbPath = path.join(userDataPath, "vantage.db");
    if (!isDev && fs.existsSync(oldDbPath) && !fs.existsSync(backendDbPath)) {
        try {
            fs.copyFileSync(oldDbPath, backendDbPath);
            console.log('📦 Migrated database from old location to data folder');
            // Keep old file as backup for now (can be manually deleted later)
            fs.renameSync(oldDbPath, path.join(userDataPath, "vantage.db.old"));
            console.log('   Old database backed up as vantage.db.old');
        } catch (err) {
            console.error('⚠️  Failed to migrate database:', err.message);
        }
    }
    
    console.log('💾 Database path:', backendDbPath);
    console.log('📁 userData directory:', userDataPath);
    console.log('🔧 isDev:', isDev);

    // if config already exists, start everything and show dashboard
    if (cfg.stats_path && cfg.db_path) {
        db = initDb(backendDbPath);
        
        // Run database migrations
        await runMigrations(db);
        
        // Initialize stats folder in database settings
        await initializeStatsFolder(db, cfg.stats_path);
        
        // Initialize playlists folder if it exists
        if (cfg.playlists_path) {
            await db.run(`
                INSERT OR REPLACE INTO app_settings (key, value)
                VALUES ('playlists_folder', ?)
            `, [cfg.playlists_path]);
        }
        
        // Start backend API server
        startServer(db, cfg.port || 3000);

        // One-time migration: recalculate durations (play time) for existing runs
        await runPlaytimeMigrationIfNeeded(db);
        
        console.log('⏳ Initializing data... Please wait...');
        
        // Wait for initial CSV scan to complete before showing UI
        watcher = await startWatcher(cfg.stats_path, db);
        
        // Auto-import playlists if enabled
        if (cfg.auto_import_playlists && cfg.playlists_path) {
            console.log('🎵 Auto-importing playlists...');
            await importPlaylistsAsPacks(cfg.playlists_path, db);
        }
        
        console.log('✅ Data loaded! Launching interface...');
        
        // Show dashboard immediately after data is ready
        createWindow(false); // Show React dashboard

        // Auto-updater (GitHub releases) - packaged builds only
        setupAutoUpdates();
    } else {
        // Show setup screen first
        createWindow(true); // Show setup HTML
    }

    // renderer will ask to pick stats folder
    ipcMain.handle("pick-stats-folder", async () => {
        const res = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
        });
        return res.filePaths[0];
    });

    // Handler for picking folder from settings page
    ipcMain.handle("pick-folder", async () => {
        const res = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
            title: "Select FPS Trainer Stats Folder"
        });
        return res.filePaths[0];
    });

    ipcMain.handle("save-config", async (e, newCfg) => {
        fs.writeFileSync(configPath, JSON.stringify(newCfg, null, 2));
        
        // Start backend services (database in userData directory)
        db = initDb(backendDbPath);
        
        // Run database migrations
        await runMigrations(db);
        
        // Initialize stats folder in database settings
        await initializeStatsFolder(db, newCfg.stats_path);
        
        // Save playlists folder to settings if provided
        if (newCfg.playlists_path) {
            await db.run(`
                INSERT OR REPLACE INTO app_settings (key, value)
                VALUES ('playlists_folder', ?)
            `, [newCfg.playlists_path]);
        }
        
        // Save auto-goals setting
        if (newCfg.auto_goals !== undefined) {
            await db.run(`
                INSERT OR REPLACE INTO app_settings (key, value)
                VALUES ('autoGoals', ?)
            `, [newCfg.auto_goals ? '1' : '0']);
        }
        
        // Save auto-import-playlists setting
        if (newCfg.auto_import_playlists !== undefined) {
            await db.run(`
                INSERT OR REPLACE INTO app_settings (key, value)
                VALUES ('auto_import_playlists', ?)
            `, [newCfg.auto_import_playlists ? '1' : '0']);
        }
        
        startServer(db, newCfg.port || 3000);

        // One-time migration: recalculate durations (play time) for existing runs
        await runPlaytimeMigrationIfNeeded(db);
        
        console.log('⏳ Scanning CSV files... This may take a moment...');
        
        // Wait for initial CSV scan to complete
        watcher = await startWatcher(newCfg.stats_path, db);
        
        // Auto-import playlists if enabled
        if (newCfg.auto_import_playlists && newCfg.playlists_path) {
            console.log('🎵 Auto-importing playlists...');
            await importPlaylistsAsPacks(newCfg.playlists_path, db);
        }
        
        console.log('✅ Setup complete! Loading dashboard...');
        
        // Switch to dashboard immediately after scan completes
        if (isDev && fs.existsSync(path.join(__dirname, '../frontend'))) {
            mainWindow.loadURL('http://localhost:5173');
        } else {
            mainWindow.loadFile(path.join(__dirname, '../public/index.html'));
        }
        
        return true;
    });

    // Add handler to check if services are ready
    ipcMain.handle("check-services", async () => {
        try {
            // Check if backend server is running
            const fetch = require('node-fetch');
            const response = await fetch('http://localhost:3000/api');
            return { ready: true, status: response.status };
        } catch (error) {
            return { ready: false, error: error.message };
        }
    });

    // Add handler to get current config
    ipcMain.handle("get-config", async () => {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, "utf-8"));
        }
        return null;
    });

    // Handler to pick a JSON file for playlist import
    ipcMain.handle("pick-playlist-json", async () => {
        // Get playlists folder from database settings
        let defaultPath;
        if (db) {
            const playlistsFolder = await getSetting(db, 'playlists_folder');
            if (playlistsFolder && fs.existsSync(playlistsFolder)) {
                defaultPath = playlistsFolder;
            }
        }
        
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            title: "Select Playlist JSON File",
            defaultPath: defaultPath,
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ]
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        
        const filePath = result.filePaths[0];
        
        try {
            // Read and parse the JSON file
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const playlistData = JSON.parse(fileContent);
            
            return {
                filePath: filePath,
                data: playlistData
            };
        } catch (error) {
            console.error('Error reading playlist JSON:', error);
            return { error: error.message };
        }
    });

    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('check-for-updates', async () => {
        if (!ensureAutoUpdaterInitialized()) {
            return { ok: false, reason: 'not_packaged' };
        }

        try {
            await autoUpdater.checkForUpdates();
            return { ok: true };
        } catch (e) {
            log.error('Manual update check failed:', e);
            return { ok: false, reason: 'error' };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            mainWindow.webContents.send('update-downloading');
            await autoUpdater.downloadUpdate();
            return { ok: true };
        } catch (e) {
            log.error('Failed to download update:', e);
            return { ok: false, error: e.message };
        }
    });

    // DEV MODE: Test update dialog (Ctrl+Shift+U)
    if (isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'u') {
                console.log('🧪 DEV: Simulating update available...');
                const mockUpdateInfo = {
                    version: '1.4.0',
                    releaseName: 'Test Update',
                    releaseDate: new Date().toISOString(),
                    releaseNotes: '### Test Features\n\n- Feature 1: New awesome feature\n- Feature 2: Another cool thing\n- Bug Fix: Fixed something important\n\nThis is a test update dialog triggered in dev mode!'
                };
                mainWindow.webContents.send('update-available', mockUpdateInfo);
            }
        });
        console.log('🧪 DEV MODE: Press Ctrl+Shift+U to test update dialog');
    }

});
