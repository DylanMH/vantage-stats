// backend/watcher.js
const chokidar = require('chokidar');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsvToRun } = require('./csvParser');
const goals = require('./goals');
const { getSetting, setSetting, getSettingBoolean } = require('./settings');
const { notifyNewRun } = require('./server');

function sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex');
}

async function hashFile(file) {
    const buf = await fs.readFile(file);
    return sha1(buf);
}

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

    // insert-or-ignore by unique hash
    const wasInserted = await db.run(
        `INSERT OR IGNORE INTO runs
     (task_id, hash, filename, path, played_at, score, accuracy, hits, shots, duration, score_per_min,
      avg_ttk, overshots, reloads, fps_avg, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, json(?))`,
        [
            task.id,
            hash,
            path.basename(file),
            file,
            parsed.played_at || new Date().toISOString(),
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
            })
        ]
    );

    const isNewRun = wasInserted.changes > 0;
    
    if (isNewRun) {
        // Update goal progress for the new run (if goals exist)
        const runData = {
            task_name: taskName,
            accuracy: parsed.accuracy,
            score: parsed.score,
            duration: parsed.duration,
            played_at: parsed.played_at || new Date().toISOString()
        };
        
        await goals.updateGoalProgress(db, runData);
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
                notifyNewRun();
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
