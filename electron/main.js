// electron/main.js
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { initDb } = require("../backend/db");
const { startWatcher } = require("../backend/watcher");
const { startServer, initializeStatsFolder } = require("../backend/server");
const { backfillHashes } = require("../backend/backfill");
const { importPlaylistsAsPacks } = require("../backend/playlistImporter");

let mainWindow;
let watcher;
let db;

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

// Check if we're in development mode (if frontend dev server is running)
const isDev = process.env.NODE_ENV === 'development' || fs.existsSync(path.join(__dirname, '../frontend/vite.config.ts'));

function createWindow(showSetup = false) {
    // Use the new Vantage Stats logo
    const iconPath = path.join(__dirname, '../assets/vs-icon-logo.png');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: iconPath,
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
    const backendDbPath = path.join(app.getPath("userData"), "vantage.db");

    // if config already exists, start everything and show dashboard
    if (cfg.stats_path && cfg.db_path) {
        db = initDb(backendDbPath);
        
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
        
        console.log('⏳ Initializing data... Please wait...');
        
        // Wait for initial CSV scan to complete before showing UI
        watcher = await startWatcher(cfg.stats_path, db);
        
        // Auto-import playlists if enabled
        if (cfg.playlists_path && cfg.auto_import_playlists) {
            console.log('🎵 Auto-importing playlists...');
            await importPlaylistsAsPacks(cfg.playlists_path, db);
        }
        
        console.log('✅ Data loaded! Launching interface...');
        
        // Show dashboard immediately after data is ready
        createWindow(false); // Show React dashboard
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
        
        console.log('⏳ Scanning CSV files... This may take a moment...');
        
        // Wait for initial CSV scan to complete
        watcher = await startWatcher(newCfg.stats_path, db);
        
        // Auto-import playlists if enabled
        if (newCfg.playlists_path && newCfg.auto_import_playlists) {
            console.log('🎵 Auto-importing playlists...');
            await importPlaylistsAsPacks(newCfg.playlists_path, db);
        }
        
        console.log('✅ Setup complete! Loading dashboard...');
        
        // Run backfill for existing data (async, don't wait)
        backfillHashes(db).then(r => console.log('hash backfill:', r)).catch(console.error);
        
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
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            title: "Select Playlist JSON File",
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
});
