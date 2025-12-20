// backend/routes/settings.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    const { getSetting, setSetting } = require('../services/settings');
    const { scanAllCsvs } = require('../core/data-import/watcher');

    // Get all application settings
    router.get('/', async (_req, res) => {
        try {
            let user = await db.get(`SELECT username FROM users WHERE id = 1`);
            const username = user?.username || 'Player';
            
            const statsFolder = await getSetting(db, 'stats_folder', '');
            const playlistsFolder = await getSetting(db, 'playlists_folder', '');
            const theme = await getSetting(db, 'theme', 'default');
            const autoGoals = await getSetting(db, 'auto_goals', 'true') === 'true';
            const notifications = await getSetting(db, 'notifications', 'true') === 'true';
            const darkMode = await getSetting(db, 'dark_mode', 'true') === 'true';
            
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

    // Update settings
    router.post('/', async (req, res) => {
        try {
            const { username, statsFolder, playlistsFolder, theme, autoGoals, notifications, darkMode } = req.body;
            
            if (username !== undefined) {
                await db.run(`
                    INSERT INTO users (id, username) VALUES (1, ?)
                    ON CONFLICT(id) DO UPDATE SET username = ?
                `, [username, username]);
            }
            if (statsFolder !== undefined) {
                await setSetting(db, 'stats_folder', statsFolder);
            }
            if (playlistsFolder !== undefined) {
                await setSetting(db, 'playlists_folder', playlistsFolder);
            }
            if (theme !== undefined) {
                await setSetting(db, 'theme', theme);
            }
            if (autoGoals !== undefined) {
                await setSetting(db, 'auto_goals', autoGoals ? 'true' : 'false');
            }
            if (notifications !== undefined) {
                await setSetting(db, 'notifications', notifications ? 'true' : 'false');
            }
            if (darkMode !== undefined) {
                await setSetting(db, 'dark_mode', darkMode ? 'true' : 'false');
            }
            
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

    // Clear all data
    router.post('/clear-data', async (_req, res) => {
        try {
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

    // Rescan stats folder
    router.post('/rescan', async (_req, res) => {
        try {
            const statsFolder = await getSetting(db, 'stats_folder', '');
            
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

    return router;
};
