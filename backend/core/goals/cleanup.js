// Script to clean up all goals and regenerate fresh ones
// backend/core/goals/cleanup.js
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

async function cleanupGoals() {
    const db = new sqlite3.Database('./kovaaks.db');
    
    // Promisify database methods
    const dbRun = promisify(db.run.bind(db));
    const dbAll = promisify(db.all.bind(db));
    const dbGet = promisify(db.get.bind(db));
    
    try {
        console.log('🧹 Cleaning up all existing goals...');
        
        // Check if tables exist
        const goalProgressExists = await dbGet(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='goal_progress'
        `);
        
        const goalsExists = await dbGet(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='goals'
        `);
        
        if (!goalsExists) {
            console.log('⚠️  Goals tables do not exist yet.');
            console.log('💡 Start the backend server first to initialize the database.');
            console.log('   Then run this cleanup script again if needed.');
            return;
        }
        
        // Delete all goal progress (if table exists)
        if (goalProgressExists) {
            await dbRun('DELETE FROM goal_progress');
            console.log('✓ Deleted all goal progress');
        } else {
            console.log('⚠️  goal_progress table not found, skipping...');
        }
        
        // Delete all goals
        await dbRun('DELETE FROM goals');
        console.log('✓ Deleted all goals');
        
        // Reset auto-increment
        await dbRun('DELETE FROM sqlite_sequence WHERE name="goals"');
        if (goalProgressExists) {
            await dbRun('DELETE FROM sqlite_sequence WHERE name="goal_progress"');
        }
        console.log('✓ Reset auto-increment counters');
        
        // Check remaining goals
        const remaining = await dbAll('SELECT COUNT(*) as count FROM goals');
        console.log(`\n📊 Goals remaining: ${remaining[0].count}`);
        
        console.log('\n✅ Cleanup complete! Restart the backend to generate fresh goals.');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        db.close();
    }
}

cleanupGoals();
