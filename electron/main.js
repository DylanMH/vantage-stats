// electron/main.js
// Main entry point for Electron application

const { app, BrowserWindow } = require('electron');
const { initializeApp } = require('./modules/appLifecycle');

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

// Initialize app when ready
app.whenReady().then(async () => {
    await initializeApp();
});

// Handle app activation (macOS)
app.on('activate', async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        await initializeApp();
    }
});

// Handle window closing (Windows/Linux)
app.on('window-all-closed', () => {
    // On macOS it's common for apps and their menu bar to stay active
    // until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
