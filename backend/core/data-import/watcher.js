// backend/core/data-import/watcher.js
const chokidar = require('chokidar');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { parseCsvToRun } = require('./csvParser');
const { toLocalISOString } = require('../../utils/time');
const { hashFile } = require('../../utils/hash');
const goals = require('../goals/goals');
const { getSetting, setSetting, getSettingBoolean } = require('../../services/settings');
const events = require('../../utils/events');
const { isRankedTask, scoreToPercentile, aggregateCategoryRating } = require('../../utils/ranked');
const { updateCategoryProgress } = require('../../utils/rankedProgress');

function deriveMetrics(parsed) {
    const out = { ...parsed };
    if (out.score != null && out.duration && out.duration > 0) {
        out.score_per_min = out.score / (out.duration / 60);
    } else {
        out.score_per_min = null;
    }
    return out;
}

function normalizeTaskName(taskName) {
    if (!taskName) return taskName;
    
    // Remove common variations and normalize
    let normalized = taskName
        // Remove date patterns
        .replace(/\s*-\s*\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}\s*Stats?$/i, '')
        .replace(/\s*-\s*Challenge\s*-\s*\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}\s*Stats?$/i, '')
        // Remove "Stats" suffix
        .replace(/\s*Stats?$/i, '')
        // Normalize spacing
        .replace(/\s+/g, ' ')
        .trim();
    
    return normalized;
}

async function upsertRun(db, file) {
    const parsed = deriveMetrics(parseCsvToRun(file));
    let taskName = (parsed.scenario && parsed.scenario.length)
        ? parsed.scenario
        : path.basename(file).replace(/\.csv$/i, '');

    // Normalize task name to group similar tasks
    taskName = normalizeTaskName(taskName);

    // ensure task
    await db.run(`INSERT OR IGNORE INTO tasks (name) VALUES (?)`, [taskName]);
    const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);

    // content hash (robust dedupe)
    const hash = await hashFile(file);

    // Check if there's an active session - if so, use its practice mode flag
    // This ensures runs always match the session they're supposed to be part of
    const activeSession = await db.get('SELECT is_practice FROM sessions WHERE is_active = 1');
    let isPracticeMode;
    
    if (activeSession) {
        // Use the session's practice mode to ensure runs are tracked correctly
        isPracticeMode = activeSession.is_practice === 1;
    } else {
        // No active session, use global practice mode setting
        isPracticeMode = await getSettingBoolean(db, 'practice_mode_active', false);
    }

    // insert-or-ignore by unique hash
    const wasInserted = await db.run(
        `INSERT OR IGNORE INTO runs
     (task_id, hash, filename, path, played_at, score, accuracy, hits, shots, duration, score_per_min,
      avg_ttk, overshots, reloads, fps_avg, meta, is_practice)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, json(?), ?)`,
        [
            task.id,
            hash,
            path.basename(file),
            file,
            parsed.played_at || toLocalISOString(new Date()),
            parsed.score ?? null,
            parsed.accuracy ?? null,
            parsed.hits ?? null,
            parsed.shots ?? null,
            parsed.duration ?? null,
            parsed.score_per_min ?? null,
            parsed.avg_ttk ?? null,
            parsed.overshots ?? null,
            parsed.reloads ?? null,
            parsed.fps_avg ?? null,
            JSON.stringify({
                dpi: parsed.dpi ?? null,
                sens_h: parsed.sens_h ?? null,
                fov: parsed.fov ?? null,
                source: 'kovaaks-csv'
            }),
            isPracticeMode ? 1 : 0
        ]
    );

    const isNewRun = wasInserted.changes > 0;
    
    if (isNewRun) {
        // Only update goal progress if NOT in practice mode
        if (!isPracticeMode) {
            const runData = {
                task_name: taskName,
                accuracy: parsed.accuracy,
                score: parsed.score,
                duration: parsed.duration,
                played_at: parsed.played_at || toLocalISOString(new Date())
            };
            
            await goals.updateGoalProgress(db, runData);
            
            // Update ranked progress if this is a ranked task
            const rankedTaskData = isRankedTask(taskName);
            if (rankedTaskData && parsed.score !== null && parsed.score !== undefined) {
                try {
                    const category = rankedTaskData.category;
                    const lastRunPercentile = scoreToPercentile(rankedTaskData.leaderboardId, parsed.score);
                    
                    if (lastRunPercentile !== null) {
                        const categoryRating = await aggregateCategoryRating(db, category, 30);
                        
                        if (categoryRating.rating !== null && !categoryRating.isProvisional) {
                            const baselines = require('../../utils/ranked').loadBaselines();
                            const categoryTasks = Object.values(baselines.tasks)
                                .filter(t => t.category === category);
                            const taskNames = categoryTasks.map(t => t.scenarioName);
                            const namePlaceholders = taskNames.map(() => '?').join(',');
                            
                            const recentRuns = await db.all(`
                                SELECT r.score, t.name
                                FROM runs r
                                JOIN tasks t ON r.task_id = t.id
                                WHERE t.name IN (${namePlaceholders})
                                  AND r.is_practice = 0
                                  AND r.score IS NOT NULL
                                ORDER BY r.played_at DESC
                                LIMIT 30
                            `, taskNames);
                            
                            const recentPercentiles = [];
                            for (const run of recentRuns) {
                                const taskData = categoryTasks.find(t => t.scenarioName === run.name);
                                if (taskData) {
                                    const pct = scoreToPercentile(taskData.leaderboardId, run.score);
                                    if (pct !== null) recentPercentiles.push(pct);
                                }
                            }
                            
                            const tierInfo = require('../../utils/ranked').getRankTier(categoryRating.rating);
                            
                            await updateCategoryProgress({
                                db,
                                category,
                                skillTier: tierInfo.tier,
                                skillPercentile: categoryRating.rating,
                                recentPercentiles,
                                lastRunPercentile,
                                distinctTasks: categoryRating.distinctTasks
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error updating ranked progress:', err);
                }
            }
        }
    }

    const row = await db.get(`SELECT id FROM runs WHERE hash = ?`, [hash]);
    return { exists: !!row, isNew: isNewRun };
}

// Scan all CSVs in directory (for initial scan)
async function scanAllCsvs(root, db) {
    let newFiles = 0;
    let duplicates = 0;
    
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) { await walk(full); continue; }
            if (!ent.isFile() || !full.toLowerCase().endsWith('.csv')) continue;

            try {
                const result = await upsertRun(db, full);
                if (result.isNew) {
                    newFiles++;
                } else if (result.exists) {
                    duplicates++;
                }
            } catch (err) {
                console.error('Scan error:', err.message, 'file:', full);
            }
        }
    }
    
    await walk(root);
    return { newFiles, duplicates, total: newFiles + duplicates };
}

// Scan only CSVs modified after a certain timestamp
async function scanNewCsvs(root, db, lastScanTimestamp) {
    let newFiles = 0;
    const cutoff = new Date(lastScanTimestamp).getTime();
    
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) { await walk(full); continue; }
            if (!ent.isFile() || !full.toLowerCase().endsWith('.csv')) continue;

            try {
                // Check file modification time
                const stats = fsSync.statSync(full);
                if (stats.mtimeMs <= cutoff) continue; // Skip old files
                
                const result = await upsertRun(db, full);
                if (result.isNew) {
                    newFiles++;
                    console.log('📁 New CSV detected:', path.basename(full));
                }
            } catch (err) {
                console.error('Incremental scan error:', err.message, 'file:', full);
            }
        }
    }
    
    await walk(root);
    return { newFiles };
}

async function startWatcher(statsPath, db) {
    const pattern = path.join(statsPath, '**', '*.csv');
    console.log('📂 Stats folder:', statsPath);

    // Check if initial scan has been completed
    const scanComplete = await getSettingBoolean(db, 'initial_scan_complete', false);
    const lastScan = await getSetting(db, 'last_scan_timestamp', null);

    if (!scanComplete) {
        console.log('🔄 First run detected - scanning all CSVs...');
        const startTime = Date.now();
        
        const result = await scanAllCsvs(statsPath, db);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log(`✅ Initial scan complete in ${elapsed}s:`);
        console.log(`   📊 ${result.newFiles} new runs imported`);
        console.log(`   ⏭️  ${result.duplicates} duplicates skipped`);
        console.log(`   📁 ${result.total} total CSV files found`);
        
        // Mark initial scan as complete
        await setSetting(db, 'initial_scan_complete', 'true');
        await setSetting(db, 'last_scan_timestamp', new Date().toISOString());
        
        // Now generate goals based on all the imported data
        console.log('🎯 Generating initial goals...');
        const goalResult = await goals.generateGoals(db);
        console.log(`✅ Generated ${goalResult.generated} goals`);
        
    } else if (lastScan) {
        console.log('📂 Checking for new CSVs since', new Date(lastScan).toLocaleString());
        const result = await scanNewCsvs(statsPath, db, lastScan);
        
        if (result.newFiles > 0) {
            console.log(`✅ Found ${result.newFiles} new runs from offline play`);
        } else {
            console.log('✓ No new CSVs found - database is up to date');
        }
        
        await setSetting(db, 'last_scan_timestamp', new Date().toISOString());
    }

    // Start live file watcher for real-time updates
    console.log('👁️  Starting real-time file watcher...');
    
    const watcher = chokidar.watch(statsPath, {  // Watch the directory, not the pattern
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        ignoreInitial: true,
        persistent: true,
        usePolling: true, // Use polling for game-created files (more reliable)
        interval: 2000, // Poll every 2 seconds
        awaitWriteFinish: { 
            stabilityThreshold: 500, // Wait 500ms for file writes to finish
            pollInterval: 100 
        },
        depth: 10, // Watch nested folders
        alwaysStat: true, // Ensure file stats are checked
        atomic: false // Some games don't write atomically
    });

    watcher.on('add', async file => {
        // Only process CSV files
        if (!file.toLowerCase().endsWith('.csv')) return;
        
        console.log('📊 New run detected:', path.basename(file));
        try {
            const result = await upsertRun(db, file);
            if (result.isNew) {
                console.log('   ✅ Imported successfully');
                
                // Update last scan timestamp so next app start knows about this file
                await setSetting(db, 'last_scan_timestamp', new Date().toISOString());
                
                // Notify frontend clients to refresh data
                events.emitNewRun();
            }
        } catch (err) {
            console.error('   ❌ Import error:', err.message);
        }
    });

    watcher.on('error', error => {
        console.error('❌ Watcher error:', error);
    });

    watcher.on('ready', () => {
        console.log('✅ Watcher ready - monitoring for new runs');
        console.log('   Watching:', statsPath);
        console.log('   Polling: Every 2 seconds\n');
    });

    return watcher;
}

module.exports = { startWatcher, scanAllCsvs };
