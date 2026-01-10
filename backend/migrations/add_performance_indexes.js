// backend/migrations/add_performance_indexes.js
// Add critical indexes for query performance optimization

module.exports = {
  up: async (db) => {
    console.log('🔧 Adding performance indexes...');
    
    // Helper to safely create index (skip if column doesn't exist)
    const safeCreateIndex = async (sql, indexName) => {
      try {
        await db.run(sql);
      } catch (error) {
        if (error.code === 'SQLITE_ERROR' && error.message.includes('no such column')) {
          console.log(`   ⚠️  Skipping ${indexName} (column doesn't exist yet)`);
        } else {
          throw error;
        }
      }
    };
    
    // Cache table indexes (for fast cache lookups)
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_cache_overall_updated ON cached_overall_stats(last_updated)', 'idx_cache_overall_updated');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_cache_task_updated ON cached_task_stats(last_updated)', 'idx_cache_task_updated');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_cache_task_last_played ON cached_task_stats(last_played DESC)', 'idx_cache_task_last_played');
    
    // Run queries optimization
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_runs_played_at ON runs(played_at DESC)', 'idx_runs_played_at');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_runs_practice ON runs(is_practice)', 'idx_runs_practice');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_runs_task_practice_time ON runs(task_id, is_practice, played_at DESC)', 'idx_runs_task_practice_time');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_runs_score ON runs(score DESC) WHERE is_practice = 0', 'idx_runs_score');
    
    // Goal queries optimization
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_goals_target_task_active ON goals(target_task_id, is_active)', 'idx_goals_target_task_active');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_time ON goal_progress(goal_id, created_at DESC)', 'idx_goal_progress_goal_time');
    
    // Session queries optimization
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC)', 'idx_sessions_started');
    await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_sessions_ended ON sessions(ended_at DESC) WHERE is_active = 0', 'idx_sessions_ended');
    
    // Enable WAL mode for better concurrency
    await db.run('PRAGMA journal_mode = WAL');
    await db.run('PRAGMA synchronous = NORMAL');
    await db.run('PRAGMA cache_size = -64000'); // 64MB cache
    
    console.log('✅ Performance indexes added successfully');
  },

  down: async (db) => {
    console.log('Removing performance indexes...');
    
    await db.run('DROP INDEX IF EXISTS idx_cache_overall_updated');
    await db.run('DROP INDEX IF EXISTS idx_cache_task_updated');
    await db.run('DROP INDEX IF EXISTS idx_cache_task_last_played');
    await db.run('DROP INDEX IF EXISTS idx_runs_played_at');
    await db.run('DROP INDEX IF EXISTS idx_runs_practice');
    await db.run('DROP INDEX IF EXISTS idx_runs_task_practice_time');
    await db.run('DROP INDEX IF EXISTS idx_runs_score');
    await db.run('DROP INDEX IF EXISTS idx_goals_target_task_active');
    await db.run('DROP INDEX IF EXISTS idx_goal_progress_goal_time');
    await db.run('DROP INDEX IF EXISTS idx_sessions_started');
    await db.run('DROP INDEX IF EXISTS idx_sessions_ended');
    
    console.log('✅ Performance indexes removed');
  }
};
