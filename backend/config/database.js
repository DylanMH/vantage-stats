// backend/config/database.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// tiny promise helpers
function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this); // lastID, changes
        });
    });
}
function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}
function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function initDb(dbPath) {
    ensureDir(dbPath);
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        skill_type TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // NOTE: rows with NULL hash are allowed, but we also add a UNIQUE index on hash
        db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        hash TEXT,                     -- SHA1 of CSV contents for dedupe
        filename TEXT,
        path TEXT,                     -- absolute file path (for backfill)
        played_at TEXT,                -- ISO
        score REAL,
        accuracy REAL,                 -- 0-100
        hits INTEGER,
        shots INTEGER,
        duration REAL,                 -- seconds (if available)
        score_per_min REAL,            -- derived when possible
        avg_ttk REAL,
        overshots INTEGER,
        reloads INTEGER,
        fps_avg REAL,
        meta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // User profile table
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL DEFAULT 'Player',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Goals table
        db.run(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        goal_type TEXT NOT NULL,        -- 'accuracy', 'score', 'consistency', 'playtime', 'ttk'
        target_value REAL NOT NULL,     -- target to achieve
        target_task_id INTEGER,         -- optional: specific task for goal
        target_pack_id INTEGER,         -- optional: specific pack for goal
        target_timeframe INTEGER,       -- optional: days to complete goal
        target_date TEXT,               -- optional: user-specified completion date
        is_active BOOLEAN DEFAULT 1,
        is_auto_generated BOOLEAN DEFAULT 0,
        is_user_created BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Goal progress tracking
        db.run(`
      CREATE TABLE IF NOT EXISTS goal_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER REFERENCES goals(id),
        current_value REAL DEFAULT 0,
        is_completed BOOLEAN DEFAULT 0,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(goal_id)
      )
    `);

        // Packs table
        db.run(`
      CREATE TABLE IF NOT EXISTS packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        game_focus TEXT,               -- e.g., 'Valorant', 'CS:GO', 'CoD'
        is_public BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Pack tasks relationship
        db.run(`
      CREATE TABLE IF NOT EXISTS pack_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id INTEGER REFERENCES packs(id),
        task_id INTEGER REFERENCES tasks(id),
        added_at TEXT DEFAULT (datetime('now')),
        UNIQUE(pack_id, task_id)
      )
    `);

        // App settings table
        db.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Sessions table - manual session tracking
        db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        notes TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        is_active BOOLEAN DEFAULT 1,
        total_runs INTEGER DEFAULT 0,
        total_duration REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Comparisons table - saved comparison presets
        db.run(`
      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        left_type TEXT NOT NULL,
        left_value TEXT NOT NULL,
        right_type TEXT NOT NULL,
        right_value TEXT NOT NULL,
        task_scope TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT
      )
    `);

        // Migrations table - track which migrations have been run
        db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

        // Ranked category progress - XP/progress tracking per category
        db.run(`
      CREATE TABLE IF NOT EXISTS ranked_category_progress (
        category TEXT PRIMARY KEY,
        xp INTEGER NOT NULL DEFAULT 0,
        progress_points INTEGER NOT NULL DEFAULT 0,
        last_updated_at TEXT,
        last_run_at TEXT,
        runs_count INTEGER NOT NULL DEFAULT 0,
        distinct_tasks_count INTEGER NOT NULL DEFAULT 0
      )
    `);

        // Create indexes for performance
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS runs_hash_idx ON runs(hash)`);
        db.run(`CREATE INDEX IF NOT EXISTS runs_task_time_idx ON runs(task_id, played_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS goals_active_idx ON goals(is_active)`);
        db.run(`CREATE INDEX IF NOT EXISTS goal_progress_completed_idx ON goal_progress(is_completed)`);
        db.run(`CREATE INDEX IF NOT EXISTS pack_tasks_pack_idx ON pack_tasks(pack_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS pack_tasks_task_idx ON pack_tasks(task_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions(is_active)`);
        db.run(`CREATE INDEX IF NOT EXISTS sessions_time_idx ON sessions(started_at, ended_at)`);
    });

    return {
        raw: db,
        run: (sql, params) => run(db, sql, params),
        get: (sql, params) => get(db, sql, params),
        all: (sql, params) => all(db, sql, params),
        close: () => new Promise((res, rej) => db.close(err => (err ? rej(err) : res()))),
    };
}

module.exports = { initDb };
