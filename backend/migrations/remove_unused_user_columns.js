// Migration to remove unused total_runs and total_playtime columns from users table
// These columns are never updated - stats are computed dynamically from runs table

module.exports = {
  up: async (db) => {
    try {
      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      
      // 1. Create new users table without the unused columns
      await db.run(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL DEFAULT 'Player',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      console.log('   ✓ Created new users table schema');
      
      // 2. Copy data from old table (only the columns we want to keep)
      await db.run(`
        INSERT INTO users_new (id, username, created_at, updated_at)
        SELECT id, username, created_at, updated_at
        FROM users
      `);
      console.log('   ✓ Migrated user data');
      
      // 3. Drop old table
      await db.run(`DROP TABLE users`);
      console.log('   ✓ Dropped old users table');
      
      // 4. Rename new table to original name
      await db.run(`ALTER TABLE users_new RENAME TO users`);
      console.log('   ✓ Renamed new table to users');
      
    } catch (err) {
      console.error('   ❌ Migration failed:', err.message);
      throw err;
    }
  },
  
  down: async (db) => {
    // Rollback: add the columns back (with default values)
    try {
      await db.run(`ALTER TABLE users ADD COLUMN total_runs INTEGER DEFAULT 0`);
      await db.run(`ALTER TABLE users ADD COLUMN total_playtime REAL DEFAULT 0`);
      console.log('   ✓ Restored total_runs and total_playtime columns');
    } catch (err) {
      console.error('   ⚠️  Rollback failed:', err.message);
    }
  }
};
