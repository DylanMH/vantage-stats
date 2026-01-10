// electron/modules/autoUpdater.js
// Auto-updater functionality

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { app } = require('electron');
const { getMainWindow, isMainWindowReady, setPendingUpdateInfo } = require('./windowManager');

let isAutoUpdaterInitialized = false;

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

async function showUpdatePrompt(info) {
    const mainWindow = getMainWindow();
    if (!mainWindow || !isMainWindowReady()) {
        setPendingUpdateInfo(info);
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

async function checkForUpdates() {
    if (!ensureAutoUpdaterInitialized()) {
        return { ok: false, reason: 'not_packaged' };
    }

    try {
        await autoUpdater.checkForUpdates();
        return { ok: true };
    } catch (e) {
        log.error('Manual update check failed:', e);
        return { ok: false, reason: 'error', error: e.message };
    }
}

async function downloadUpdate() {
    const mainWindow = getMainWindow();
    try {
        if (mainWindow) {
            mainWindow.webContents.send('update-downloading');
        }
        await autoUpdater.downloadUpdate();
        return { ok: true };
    } catch (e) {
        log.error('Failed to download update:', e);
        return { ok: false, error: e.message };
    }
}

// Make showUpdatePrompt available globally for windowManager
global.showUpdatePrompt = showUpdatePrompt;

module.exports = {
    ensureAutoUpdaterInitialized,
    showUpdatePrompt,
    setupAutoUpdates,
    checkForUpdates,
    downloadUpdate
};
