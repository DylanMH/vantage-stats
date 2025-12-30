const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { getSetting } = require('../services/settings');

// Get all playlists with task count
router.get('/', async (req, res) => {
    try {
        const db = req.app.get('db');
        const rows = await db.all(`
            SELECT 
                p.*,
                COUNT(pt.task_id) as task_count
            FROM packs p
            LEFT JOIN pack_tasks pt ON p.id = pt.pack_id
            GROUP BY p.id
            ORDER BY p.name ASC
        `);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// Get playlist details with tasks
router.get('/:id/tasks', async (req, res) => {
    try {
        const db = req.app.get('db');
        const playlistId = req.params.id;
        const playlist = await db.get(`SELECT * FROM packs WHERE id = ?`, [playlistId]);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        const tasks = await db.all(`
            SELECT t.* 
            FROM tasks t
            INNER JOIN pack_tasks pt ON t.id = pt.task_id
            WHERE pt.pack_id = ?
            ORDER BY t.name ASC
        `, [playlistId]);
        
        res.json({ ...playlist, tasks });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch playlist tasks' });
    }
});

// Get current stats for a specific playlist
router.get('/:id/stats', async (req, res) => {
    try {
        const db = req.app.get('db');
        const { id } = req.params;
        
        const stats = await db.get(`
            SELECT 
                AVG(r.accuracy) as avg_accuracy,
                AVG(r.score) as avg_score,
                AVG(r.avg_ttk) as avg_ttk,
                COUNT(DISTINCT r.id) as total_runs,
                COUNT(DISTINCT r.task_id) as tasks_played
            FROM runs r
            JOIN pack_tasks pt ON r.task_id = pt.task_id
            WHERE pt.pack_id = ? AND r.accuracy IS NOT NULL
        `, [id]);
        
        res.json(stats || {
            avg_accuracy: 0,
            avg_score: 0,
            avg_ttk: 0,
            total_runs: 0,
            tasks_played: 0
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch playlist stats' });
    }
});

// Delete a playlist
router.delete('/:id', async (req, res) => {
    try {
        const db = req.app.get('db');
        const playlistId = req.params.id;
        
        await db.run(`DELETE FROM pack_tasks WHERE pack_id = ?`, [playlistId]);
        await db.run(`DELETE FROM packs WHERE id = ?`, [playlistId]);
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

// Create a new playlist (either from Kovaak's JSON or from ranked tasks)
router.post('/', async (req, res) => {
    try {
        const db = req.app.get('db');
        const { name, description, game_focus, tasks } = req.body;
        
        console.log('🔍 POST /api/playlists - Creating playlist:', { name, description, game_focus, taskCount: tasks?.length });
        
        // Check if playlist with same name already exists (case-insensitive)
        const existing = await db.get('SELECT id FROM packs WHERE LOWER(TRIM(name)) = LOWER(?)', [name]);
        if (existing) {
            console.log(`⚠️ Playlist already exists: ${name}`);
            return res.status(400).json({ error: `Playlist "${name}" already exists` });
        }
        
        const result = await db.run(
            `INSERT INTO packs (name, description, game_focus) VALUES (?, ?, ?)`,
            [name, description || null, game_focus || 'Custom Playlist']
        );
        
        const playlistId = result.lastID;
        console.log('✅ Playlist created with ID:', playlistId);
        
        if (tasks && tasks.length > 0) {
            console.log('🔗 Linking tasks to playlist...');
            for (const taskName of tasks) {
                // Case-insensitive task lookup
                const task = await db.get(`SELECT id FROM tasks WHERE LOWER(TRIM(name)) = LOWER(?)`, [taskName]);
                if (task) {
                    await db.run(
                        `INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`,
                        [playlistId, task.id]
                    );
                    console.log(`  ✓ Linked task: ${taskName}`);
                } else {
                    // Create task if it doesn't exist
                    const taskResult = await db.run(
                        'INSERT INTO tasks (name, created_at) VALUES (?, datetime(\'now\'))',
                        [taskName]
                    );
                    await db.run(
                        `INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`,
                        [playlistId, taskResult.lastID]
                    );
                    console.log(`  ✓ Created and linked task: ${taskName}`);
                }
            }
        }
        
        const playlist = await db.get(`SELECT * FROM packs WHERE id = ?`, [playlistId]);
        res.json(playlist);
    } catch (e) {
        console.error('❌ POST /api/playlists ERROR:', e);
        res.status(500).json({ error: 'Failed to create playlist', details: e.message });
    }
});

// Create playlist JSON file for Kovaak's
router.post('/create', async (req, res) => {
    try {
        const { playlistName, scenarios } = req.body;
        
        if (!playlistName || !playlistName.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Playlist name is required' 
            });
        }
        
        if (!Array.isArray(scenarios) || scenarios.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'At least one scenario is required' 
            });
        }
        
        const db = req.app.get('db');
        const playlistsFolder = await getSetting(db, 'playlists_folder', null);
        
        if (!playlistsFolder) {
            return res.status(400).json({ 
                success: false, 
                error: 'Playlists folder not configured. Please set it in Settings.' 
            });
        }
        
        if (!fsSync.existsSync(playlistsFolder)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Playlists folder does not exist. Please check your settings.' 
            });
        }
        
        const scenarioList = scenarios.map(scenarioName => ({
            scenario_name: scenarioName,
            play_Count: 2
        }));
        
        const playlistData = {
            playlistName: playlistName.trim(),
            description: `Generated from Vantage Stats Ranked system`,
            authorName: "Vantage Stats",
            scenarioList: scenarioList
        };
        
        const safeFileName = playlistName.trim().replace(/[^a-z0-9_\-\s]/gi, '_');
        const filePath = path.join(playlistsFolder, `${safeFileName}.json`);
        
        await fs.writeFile(filePath, JSON.stringify(playlistData, null, 2), 'utf-8');
        
        console.log(`✅ Created playlist file: ${playlistName} (${scenarios.length} tasks) at ${filePath}`);
        
        // Also add playlist to database for immediate visibility
        try {
            // Check if playlist already exists in database
            const existingPlaylist = await db.get(
                'SELECT id FROM packs WHERE LOWER(TRIM(name)) = LOWER(?)',
                [playlistName.trim()]
            );
            
            if (!existingPlaylist) {
                // Create playlist in database
                const result = await db.run(
                    'INSERT INTO packs (name, description, game_focus, created_at) VALUES (?, ?, ?, datetime(\'now\'))',
                    [playlistName.trim(), 'Generated from Vantage Stats Ranked system', 'Ranked', ]
                );
                
                const playlistId = result.lastID;
                console.log(`✅ Added playlist to database with ID: ${playlistId}`);
                
                // Link tasks to playlist
                for (const scenarioName of scenarios) {
                    // Find or create task
                    let task = await db.get(
                        'SELECT id FROM tasks WHERE LOWER(TRIM(name)) = LOWER(?)',
                        [scenarioName]
                    );
                    
                    if (!task) {
                        const taskResult = await db.run(
                            'INSERT INTO tasks (name, created_at) VALUES (?, datetime(\'now\'))',
                            [scenarioName]
                        );
                        task = { id: taskResult.lastID };
                    }
                    
                    // Link task to playlist
                    await db.run(
                        'INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)',
                        [playlistId, task.id]
                    );
                }
                
                console.log(`✅ Linked ${scenarios.length} tasks to playlist`);
            } else {
                console.log(`ℹ️ Playlist already exists in database with ID: ${existingPlaylist.id}`);
            }
        } catch (dbError) {
            console.error('⚠️ Failed to add playlist to database (file was still created):', dbError.message);
            // Don't fail the request - file was created successfully
        }
        
        res.json({ 
            success: true, 
            filePath: filePath,
            taskCount: scenarios.length
        });
        
    } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to create playlist' 
        });
    }
});

module.exports = router;
