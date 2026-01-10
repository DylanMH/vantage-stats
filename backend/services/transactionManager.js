// backend/services/transactionManager.js
// Safe transaction wrapper for database operations

class TransactionManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Execute operations within a transaction
   * Automatically rolls back on error
   */
  async withTransaction(operations) {
    try {
      await this.db.run('BEGIN IMMEDIATE TRANSACTION');
      
      const result = await operations(this.db);
      
      await this.db.run('COMMIT');
      return result;
    } catch (error) {
      await this.db.run('ROLLBACK');
      console.error('❌ Transaction failed, rolled back:', error.message);
      throw error;
    }
  }

  /**
   * Batch insert runs with transaction safety
   */
  async batchInsertRuns(runs) {
    return await this.withTransaction(async (db) => {
      const inserted = [];
      
      for (const run of runs) {
        const result = await db.run(
          `INSERT OR IGNORE INTO runs 
           (task_id, hash, filename, path, played_at, score, accuracy, 
            hits, shots, duration, score_per_min, avg_ttk, overshots, 
            reloads, fps_avg, meta, is_practice)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            run.task_id,
            run.hash,
            run.filename,
            run.path,
            run.played_at,
            run.score,
            run.accuracy,
            run.hits,
            run.shots,
            run.duration,
            run.score_per_min,
            run.avg_ttk,
            run.overshots,
            run.reloads,
            run.fps_avg,
            JSON.stringify(run.meta || {}),
            run.is_practice || 0
          ]
        );
        
        if (result.changes > 0) {
          inserted.push(result.lastID);
        }
      }
      
      return inserted;
    });
  }

  /**
   * Safely update cache with transaction
   */
  async updateCacheInTransaction(cacheUpdates) {
    return await this.withTransaction(async (db) => {
      for (const update of cacheUpdates) {
        await db.run(update.sql, update.params);
      }
    });
  }

  /**
   * Import data from external source with safety
   */
  async safeImport(importData) {
    console.log(`🔄 Starting safe import: ${importData.runs?.length || 0} runs`);
    
    return await this.withTransaction(async (db) => {
      const results = {
        runs: 0,
        tasks: 0,
        errors: []
      };

      // Import tasks first (dependencies)
      if (importData.tasks) {
        for (const task of importData.tasks) {
          try {
            await db.run(
              'INSERT OR IGNORE INTO tasks (id, name, normalized_name) VALUES (?, ?, ?)',
              [task.id, task.name, task.normalized_name]
            );
            results.tasks++;
          } catch (error) {
            results.errors.push({ type: 'task', error: error.message });
          }
        }
      }

      // Import runs
      if (importData.runs) {
        for (const run of importData.runs) {
          try {
            const result = await db.run(
              `INSERT OR IGNORE INTO runs 
               (task_id, hash, filename, played_at, score, accuracy, 
                duration, is_practice)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                run.task_id,
                run.hash,
                run.filename,
                run.played_at,
                run.score,
                run.accuracy,
                run.duration,
                run.is_practice || 0
              ]
            );
            
            if (result.changes > 0) {
              results.runs++;
            }
          } catch (error) {
            results.errors.push({ type: 'run', error: error.message });
          }
        }
      }

      return results;
    });
  }
}

module.exports = { TransactionManager };
