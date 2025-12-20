// Migration to add practice mode functionality
// Adds: is_practice column to runs table

module.exports = {
  up: async (db) => {
    // Add is_practice column to runs table
    try {
      await db.run(`ALTER TABLE runs ADD COLUMN is_practice BOOLEAN DEFAULT 0`);
      console.log('   ✓ Added is_practice column to runs table');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
    
    // Add index for practice runs filtering
    try {
      await db.run(`CREATE INDEX IF NOT EXISTS runs_practice_idx ON runs(is_practice)`);
      console.log('   ✓ Added index for practice runs');
    } catch (err) {
      console.error('   ⚠️  Index creation failed:', err.message);
    }
  },
  
  down: async (db) => {
    // SQLite doesn't support DROP COLUMN easily, so rollback would require table recreation
    console.log('⚠️  Rollback not supported - SQLite limitation');
  }
};
