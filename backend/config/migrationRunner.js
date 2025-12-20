// backend/config/migrationRunner.js
const fs = require('fs');
const path = require('path');
const { initDb } = require('./database');

/**
 * Migration runner with tracking
 * Only runs migrations that haven't been applied yet
 * Records completed migrations in the database
 */
async function runMigrations(db) {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir);
      console.log('📁 Created migrations directory');
      return;
    }
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Run in alphabetical order
    
    if (migrationFiles.length === 0) {
      return; // No migrations, exit silently
    }
    
    // Get list of already-applied migrations
    const appliedMigrations = await db.all(`SELECT name FROM migrations`);
    const appliedSet = new Set(appliedMigrations.map(m => m.name));
    
    // Filter to only migrations that haven't been run
    const pendingMigrations = migrationFiles.filter(file => !appliedSet.has(file));
    
    if (pendingMigrations.length === 0) {
      return; // All migrations already applied, exit silently
    }
    
    console.log(`🔄 Running ${pendingMigrations.length} pending migration(s)...`);
    
    for (const file of pendingMigrations) {
      const migrationPath = path.join(migrationsDir, file);
      const migration = require(migrationPath);
      
      if (typeof migration.up === 'function') {
        console.log(`  ⚙️  Applying: ${file}`);
        
        try {
          await migration.up(db);
          
          // Record successful migration
          await db.run(`INSERT INTO migrations (name) VALUES (?)`, [file]);
          console.log(`  ✅ Completed: ${file}`);
        } catch (error) {
          console.error(`  ❌ Failed: ${file}`, error);
          throw error; // Stop on first failure
        }
      }
    }
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

module.exports = { runMigrations };
