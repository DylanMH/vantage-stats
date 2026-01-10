// electron/modules/windowManager.js
// Window creation and management

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let mainWindowDidFinishLoad = false;
let pendingUpdateInfo = null;

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || fs.existsSync(path.join(__dirname, '../../frontend/vite.config.ts'));

function createWindow(showSetup = false) {
    // Use the new Vantage Stats logo
    const iconPath = path.join(__dirname, '../../assets/vs-icon-logo.png');

    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
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
            // Will be handled by autoUpdater module
            if (global.showUpdatePrompt) {
                global.showUpdatePrompt(info);
            }
        }
    });

    if (showSetup) {
        // Load the setup page (basic HTML for folder selection)
        mainWindow.loadFile(path.join(__dirname, '../index.html'));
    } else {
        // In development, load from Vite dev server; in production, load from built files
        if (isDev && fs.existsSync(path.join(__dirname, '../../frontend'))) {
            mainWindow.loadURL('http://localhost:5173');
            // Open DevTools in development
            // mainWindow.webContents.openDevTools();
        } else {
            // Load from built files
            mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
        }
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

function isMainWindowReady() {
    return mainWindowDidFinishLoad;
}

function setPendingUpdateInfo(info) {
    pendingUpdateInfo = info;
}

function switchToDashboard() {
    if (!mainWindow) return;
    
    if (isDev && fs.existsSync(path.join(__dirname, '../../frontend'))) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
    }
}

// DEV MODE: Test update dialog (Ctrl+Shift+U)
if (isDev && mainWindow) {
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

module.exports = {
    createWindow,
    getMainWindow,
    isMainWindowReady,
    setPendingUpdateInfo,
    switchToDashboard,
    isDev
};
