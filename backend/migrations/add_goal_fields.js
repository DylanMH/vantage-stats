// Migration to add new goal fields for v1.2.0
// Adds: target_pack_id, target_date, is_user_created

module.exports = {
  up: async (db) => {
    // Add target_pack_id column if it doesn't exist
    try {
      await db.run(`ALTER TABLE goals ADD COLUMN target_pack_id INTEGER DEFAULT NULL`);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
    
    // Add target_date column if it doesn't exist
    try {
      await db.run(`ALTER TABLE goals ADD COLUMN target_date TEXT DEFAULT NULL`);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
    
    // Add is_user_created column if it doesn't exist
    try {
      await db.run(`ALTER TABLE goals ADD COLUMN is_user_created BOOLEAN DEFAULT 0`);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
  },
  
  down: async (db) => {
    // SQLite doesn't support DROP COLUMN easily, so rollback would require table recreation
    // Not implemented for this migration
    console.log('⚠️  Rollback not supported - SQLite limitation');
  }
};
