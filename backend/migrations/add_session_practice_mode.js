// Migration to add practice mode support to sessions
// Adds: is_practice column to sessions table

module.exports = {
  up: async (db) => {
    // Add is_practice column to sessions table
    try {
      await db.run(`ALTER TABLE sessions ADD COLUMN is_practice BOOLEAN DEFAULT 0`);
      console.log('   ✓ Added is_practice column to sessions table');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
    
    // Add index for practice sessions filtering
    try {
      await db.run(`CREATE INDEX IF NOT EXISTS sessions_practice_idx ON sessions(is_practice)`);
      console.log('   ✓ Added index for practice sessions');
    } catch (err) {
      console.error('   ⚠️  Index creation failed:', err.message);
    }
  },
  
  down: async (db) => {
    // SQLite doesn't support DROP COLUMN easily, so rollback would require table recreation
    console.log('⚠️  Rollback not supported - SQLite limitation');
  }
};
