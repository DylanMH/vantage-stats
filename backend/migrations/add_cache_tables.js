// backend/config/migrations/add_cache_tables.js
// Migration to add performance caching tables

module.exports = {
  up: async (db) => {
    console.log('Creating cache tables for performance optimization...');
    
    // Overall cached stats table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cached_overall_stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        total_runs INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        unique_tasks INTEGER DEFAULT 0,
        avg_accuracy REAL DEFAULT 0,
        max_accuracy REAL DEFAULT 0,
        avg_score REAL DEFAULT 0,
        max_score REAL DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        avg_ttk REAL DEFAULT 0,
        avg_shots REAL DEFAULT 0,
        total_shots INTEGER DEFAULT 0,
        avg_overshots REAL DEFAULT 0,
        avg_reload_count REAL DEFAULT 0,
        avg_fps REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 1)
      )
    `);

    // Task-specific cached stats table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cached_task_stats (
        task_id INTEGER PRIMARY KEY,
        task_name TEXT,
        total_runs INTEGER DEFAULT 0,
        avg_accuracy REAL DEFAULT 0,
        max_accuracy REAL DEFAULT 0,
        avg_score REAL DEFAULT 0,
        max_score REAL DEFAULT 0,
        avg_ttk REAL DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        avg_shots REAL DEFAULT 0,
        total_shots INTEGER DEFAULT 0,
        recent_avg_accuracy REAL DEFAULT 0,  -- Last 10 runs
        best_score INTEGER,
        best_accuracy REAL,
        last_played DATETIME,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Time-based cached stats table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cached_time_stats (
        time_period TEXT PRIMARY KEY,  -- 'today', '7days', '30days', 'all'
        total_runs INTEGER DEFAULT 0,
        unique_tasks INTEGER DEFAULT 0,
        avg_accuracy REAL DEFAULT 0,
        avg_score REAL DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        best_task_name TEXT,
        best_task_accuracy REAL DEFAULT 0,
        best_task_score INTEGER,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await db.run('CREATE INDEX IF NOT EXISTS idx_cached_task_stats_name ON cached_task_stats(task_name)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cached_task_stats_last_played ON cached_task_stats(last_played DESC)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cached_time_stats_period ON cached_time_stats(time_period)');

    // Initialize overall stats row
    await db.run(`
      INSERT OR IGNORE INTO cached_overall_stats (id) VALUES (1)
    `);

    // Initialize time periods
    const timePeriods = ['today', '7days', '30days', 'all'];
    for (const period of timePeriods) {
      await db.run(`
        INSERT OR IGNORE INTO cached_time_stats (time_period) VALUES (?)
      `, [period]);
    }

    console.log('✅ Cache tables created successfully');
  },

  down: async (db) => {
    console.log('Removing cache tables...');
    await db.run('DROP TABLE IF EXISTS cached_overall_stats');
    await db.run('DROP TABLE IF EXISTS cached_task_stats');
    await db.run('DROP TABLE IF EXISTS cached_time_stats');
    console.log('✅ Cache tables removed');
  }
};
