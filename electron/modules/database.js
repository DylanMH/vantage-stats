// electron/modules/database.js
// Database setup and migrations

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { initDb } = require('../../backend/config/database');
const { runMigrations } = require('../../backend/config/migrationRunner');
const { initializeStatsFolder } = require('../../backend/config/server');
const { parseCsvToRun } = require('../../backend/core/data-import/csvParser');
const { getSetting, setSetting } = require('../../backend/services/settings');
const { BackupManager } = require('../../backend/services/backupManager');
const { IntegrityChecker } = require('../../backend/services/integrityChecker');

async function runPlaytimeMigrationIfNeeded(db) {
    const migrationKey = 'playtime_migration_v2_done';
    const alreadyDone = await getSetting(db, migrationKey, null);
    if (alreadyDone === 'true' || alreadyDone === '1') {
        return;
    }

    console.log('⏳ Running one-time playtime migration (recalculating run durations from CSVs)...');

    const rows = await db.all(
        `SELECT id, path, score FROM runs WHERE path IS NOT NULL AND TRIM(path) <> '' ORDER BY id ASC`
    );

    let updated = 0;
    let skippedMissingFile = 0;
    let skippedNoDuration = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            if (!fs.existsSync(row.path)) {
                skippedMissingFile++;
                continue;
            }

            const parsed = parseCsvToRun(row.path);
            const duration = parsed?.duration;
            if (duration == null || !Number.isFinite(duration) || duration <= 0) {
                skippedNoDuration++;
                continue;
            }

            const score = parsed?.score != null ? parsed.score : row.score;
            const scorePerMin = (score != null && duration > 0) ? score / (duration / 60) : null;

            await db.run(
                `UPDATE runs SET duration = ?, score_per_min = ? WHERE id = ?`,
                [duration, scorePerMin, row.id]
            );
            updated++;
        } catch {
            errors++;
        }
    }

    await setSetting(db, migrationKey, 'true');
    console.log(`✅ Playtime migration complete: updated ${updated}/${rows.length} runs (missing files: ${skippedMissingFile}, no duration: ${skippedNoDuration}, errors: ${errors})`);
}

function setupDatabase(isDev, customDataDir = null) {
    // Database lives in custom data directory if specified, otherwise userData
    const userDataPath = customDataDir || app.getPath("userData");
    const dataDir = path.join(userDataPath, "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbFileName = isDev ? "vantage-dev.db" : "vantage.db";
    const backendDbPath = path.join(dataDir, dbFileName);
    
    // Migrate old database location to new folder structure (for existing users)
    const oldDbPath = path.join(userDataPath, "vantage.db");
    if (!isDev && fs.existsSync(oldDbPath) && !fs.existsSync(backendDbPath)) {
        try {
            fs.copyFileSync(oldDbPath, backendDbPath);
            console.log('📦 Migrated database from old location to data folder');
            // Keep old file as backup for now (can be manually deleted later)
            fs.renameSync(oldDbPath, path.join(userDataPath, "vantage.db.old"));
            console.log('   Old database backed up as vantage.db.old');
        } catch (err) {
            console.error('⚠️  Failed to migrate database:', err.message);
        }
    }
    
    console.log('💾 Database path:', backendDbPath);
    console.log('📁 userData directory:', userDataPath);
    console.log('🔧 isDev:', isDev);

    const db = initDb(backendDbPath);
    return db;
}

async function initializeDatabase(db, config) {
    // Use custom data directory if specified, otherwise default to userData
    const dataDirectory = config.data_directory || app.getPath('userData');
    const dbPath = path.join(dataDirectory, 'data', 'vantage.db');
    
    // Initialize backup manager
    const backupManager = new BackupManager(dbPath);
    
    // Create daily backup if needed (before any migrations or changes)
    await backupManager.createDailyBackupIfNeeded();
    
    // Run database migrations
    await runMigrations(db);
    
    // Initialize stats folder in database settings
    await initializeStatsFolder(db, config.stats_path);
    
    // Initialize playlists folder if it exists
    if (config.playlists_path) {
        await db.run(`
            INSERT OR REPLACE INTO app_settings (key, value)
            VALUES ('playlists_folder', ?)
        `, [config.playlists_path]);
    }
    
    // One-time migration: recalculate durations (play time) for existing runs
    await runPlaytimeMigrationIfNeeded(db);
    
    // Schedule automatic backups (daily check every 6 hours)
    backupManager.scheduleAutomaticBackups();
    
    // Log backup stats
    const stats = await backupManager.getBackupStats();
    console.log(`📦 Backup system active: ${stats.count} backups (${stats.totalSizeMB} MB)`);
    
    // Run data integrity checks
    const integrityChecker = new IntegrityChecker(db);
    const integrityReport = await integrityChecker.runAllChecks();
    
    // Auto-fix minor issues if found
    if (!integrityReport.healthy && integrityReport.errors === 0) {
        await integrityChecker.autoFixIssues(integrityReport);
    }
    
    // Log database stats
    const dbStats = await integrityChecker.getDatabaseStats();
    console.log(`📊 Database stats: ${dbStats.totalRuns} runs, ${dbStats.totalTasks} tasks, ${dbStats.dbSize} MB`);
    
    return { backupManager, integrityChecker };
}

module.exports = {
    setupDatabase,
    initializeDatabase,
    runPlaytimeMigrationIfNeeded
};
