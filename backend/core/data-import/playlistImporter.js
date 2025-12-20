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
                const playlistName = playlist.playlistName || path.basename(file, '.json');
                const scenarioList = playlist.scenarioList || [];

                // Extract scenario names from objects (each has scenario_name property)
                const scenarios = scenarioList.map(item => {
                    return typeof item === 'string' ? item : item.scenario_name;
                }).filter(name => name && name.trim());

                if (scenarios.length === 0) {
                    console.log(`  ⏭️  Skipping empty playlist: ${playlistName}`);
                    skipped++;
                    continue;
                }

                // Check if pack already exists
                const existing = await db.get(
                    'SELECT id FROM packs WHERE name = ?',
                    [playlistName]
                );

                if (existing) {
                    console.log(`  ⏭️  Pack already exists: ${playlistName}`);
                    skipped++;
                    continue;
                }

                // Create pack with playlist description and author
                const description = playlist.description || `Imported from Kovaak's playlist: ${file}`;
                const author = playlist.authorName ? ` by ${playlist.authorName}` : '';
                
                const result = await db.run(`
                    INSERT INTO packs (name, description, game_focus, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                `, [
                    playlistName,
                    description + author,
                    'Kovaak\'s Playlist'
                ]);

                const packId = result.lastID;

                // Add tasks to pack
                let addedTasks = 0;
                for (const scenarioName of scenarios) {
                    // Find or create task
                    let task = await db.get(
                        'SELECT id FROM tasks WHERE name = ?',
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

                    // Link task to pack
                    await db.run(`
                        INSERT OR IGNORE INTO pack_tasks (pack_id, task_id)
                        VALUES (?, ?)
                    `, [packId, task.id]);

                    addedTasks++;
                }

                console.log(`  ✅ Imported: ${playlistName} (${addedTasks} tasks)`);
                imported++;

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
