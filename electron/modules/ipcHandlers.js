// electron/modules/ipcHandlers.js
// All IPC handlers for communication with renderer

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { startServer } = require('../../backend/config/server');
const { importPlaylistsAsPacks } = require('../../backend/core/data-import/playlistImporter');
const { getSetting } = require('../../backend/services/settings');
const { checkForUpdates, downloadUpdate } = require('./autoUpdater');
const { getMainWindow, switchToDashboard } = require('./windowManager');
const { setupDatabase, initializeDatabase } = require('./database');
const { setDataDirectory, writeConfig, readConfig, getDataDirectory } = require('./dataLocation');

let db = null;

function initializeIpcHandlers(database) {
    db = database;

    // renderer will ask to pick stats folder
    ipcMain.handle("pick-stats-folder", async () => {
        const mainWindow = getMainWindow();
        const res = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
        });
        return res.filePaths[0];
    });

    // Handler for picking folder from settings page
    ipcMain.handle("pick-folder", async () => {
        const mainWindow = getMainWindow();
        const res = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
            title: "Select Folder"
        });
        return res.filePaths[0];
    });

    // Handler to get default data directory (AppData)
    ipcMain.handle("get-default-data-dir", async () => {
        return app.getPath('userData');
    });

    ipcMain.handle("save-config", async (e, newCfg) => {
        // Set data directory in bootstrap file (creates directory structure)
        const success = setDataDirectory(newCfg.data_directory);
        if (!success) {
            throw new Error('Failed to set data directory');
        }
        
        // Save config to data directory (not AppData)
        const configSaved = writeConfig(newCfg);
        if (!configSaved) {
            throw new Error('Failed to save config');
        }
        
        // Start backend services with custom data directory
        const isDev = process.env.NODE_ENV === 'development';
        db = setupDatabase(isDev, newCfg.data_directory);
        
        // Initialize database
        await initializeDatabase(db, newCfg);
        
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
        const { runPlaytimeMigrationIfNeeded } = require('./database');
        await runPlaytimeMigrationIfNeeded(db);
        
        console.log('⏳ Scanning CSV files... This may take a moment...');
        
        // Wait for initial CSV scan to complete
        const { startWatcher } = require('../../backend/core/data-import/watcher');
        const watcher = await startWatcher(newCfg.stats_path, db);
        
        // Auto-import playlists if enabled
        if (newCfg.auto_import_playlists && newCfg.playlists_path) {
            console.log('🎵 Auto-importing playlists...');
            await importPlaylistsAsPacks(newCfg.playlists_path, db);
        }
        
        console.log('✅ Setup complete! Loading dashboard...');
        
        // Switch to dashboard immediately after scan completes
        switchToDashboard();
        
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

    // Add handler to get current config (from data directory)
    ipcMain.handle("get-config", async () => {
        return readConfig();
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
        
        const mainWindow = getMainWindow();
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
            return { 
                filePath: '',
                data: undefined,
                error: error.message 
            };
        }
    });

    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('check-for-updates', checkForUpdates);

    ipcMain.handle('download-update', downloadUpdate);
}

module.exports = { initializeIpcHandlers };
