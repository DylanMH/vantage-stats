// backend/core/data-import/playlistImporter.js
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Import Kovaak's playlist JSON files as packs
 * @param {string} playlistsFolder - Path to Kovaak's Playlists folder
 * @param {object} db - Database instance
 * @returns {Promise<{imported: number, skipped: number, errors: number}>}
 */
async function importPlaylistsAsPacks(playlistsFolder, db) {
    if (!playlistsFolder || !fsSync.existsSync(playlistsFolder)) {
        console.log('📁 Playlists folder not configured or does not exist');
        return { imported: 0, skipped: 0, errors: 0 };
    }

    console.log('🎵 Auto-importing playlists from:', playlistsFolder);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
        const files = await fs.readdir(playlistsFolder);
        const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(playlistsFolder, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const playlist = JSON.parse(content);

                // Extract playlist name and scenarios
                const playlistName = (playlist.playlistName || path.basename(file, '.json')).trim();
                const scenarioList = playlist.scenarioList || [];

                // Extract scenario names from objects (each has scenario_name property)
                const scenarios = scenarioList
                    .map(item => {
                        if (typeof item === 'string') {
                            return item.trim();
                        }
                        return (item.scenario_name || item.scenarioName || '').trim();
                    })
                    .filter(name => name.length > 0);

                if (scenarios.length === 0) {
                    console.log(`  ⏭️  Skipping empty playlist: ${playlistName}`);
                    skipped++;
                    continue;
                }

                // Check if playlist already exists by name (case-insensitive)
                const existing = await db.get(
                    'SELECT id, name FROM packs WHERE LOWER(TRIM(name)) = LOWER(?)',
                    [playlistName]
                );

                if (existing) {
                    // Check if task count matches - if not, update the playlist
                    const existingTasks = await db.all(
                        'SELECT task_id FROM pack_tasks WHERE pack_id = ?',
                        [existing.id]
                    );
                    
                    if (existingTasks.length !== scenarios.length) {
                        console.log(`  🔄 Updating playlist: ${playlistName} (${existingTasks.length} -> ${scenarios.length} tasks)`);
                        // Continue to update the playlist
                    } else {
                        console.log(`  ⏭️  Playlist already exists: ${playlistName} (${scenarios.length} tasks)`);
                        skipped++;
                        continue;
                    }
                }

                // Create or update playlist
                let packId;
                const description = playlist.description || `Imported from Kovaak's playlist: ${file}`;
                const author = playlist.authorName ? ` by ${playlist.authorName}` : '';
                
                if (existing) {
                    // Update existing playlist
                    packId = existing.id;
                    await db.run(`
                        UPDATE packs 
                        SET description = ?, game_focus = ?, created_at = datetime('now')
                        WHERE id = ?
                    `, [description + author, 'Kovaak\'s Playlist', packId]);
                    
                    // Clear existing tasks
                    await db.run('DELETE FROM pack_tasks WHERE pack_id = ?', [packId]);
                } else {
                    // Create new playlist
                    const result = await db.run(`
                        INSERT INTO packs (name, description, game_focus, created_at)
                        VALUES (?, ?, ?, datetime('now'))
                    `, [
                        playlistName,
                        description + author,
                        'Kovaak\'s Playlist'
                    ]);
                    packId = result.lastID;
                }

                // Add all tasks to playlist
                let addedTasks = 0;
                for (const scenarioName of scenarios) {
                    // Find or create task (case-insensitive match)
                    let task = await db.get(
                        'SELECT id FROM tasks WHERE LOWER(TRIM(name)) = LOWER(?)',
                        [scenarioName]
                    );

                    if (!task) {
                        // Task doesn't exist yet, create placeholder
                        const taskResult = await db.run(
                            'INSERT INTO tasks (name, created_at) VALUES (?, datetime(\'now\'))',
                            [scenarioName]
                        );
                        task = { id: taskResult.lastID };
                    }

                    // Link task to playlist
                    await db.run(`
                        INSERT OR IGNORE INTO pack_tasks (pack_id, task_id)
                        VALUES (?, ?)
                    `, [packId, task.id]);

                    addedTasks++;
                }

                if (existing) {
                    console.log(`  ✅ Updated: ${playlistName} (${addedTasks} tasks)`);
                } else {
                    console.log(`  ✅ Imported: ${playlistName} (${addedTasks} tasks)`);
                    imported++;
                }

            } catch (err) {
                console.error(`  ❌ Error importing ${file}:`, err.message);
                errors++;
            }
        }

        console.log(`📊 Playlist import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        return { imported, skipped, errors };

    } catch (err) {
        console.error('❌ Failed to read playlists folder:', err.message);
        return { imported: 0, skipped: 0, errors: 1 };
    }
}

module.exports = { importPlaylistsAsPacks };
