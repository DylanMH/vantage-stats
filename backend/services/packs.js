// backend/services/packs.js
const packs = {
  // Initialize default packs for popular games
  async initializeDefaultPacks(db) {
    try {

      let createdPacks = 0;
      let addedTasks = 0;

      for (const packData of defaultPacks) {
        // Check if pack already exists
        const existingPack = await db.get(`SELECT id FROM packs WHERE name = ?`, [packData.name]);
        
        let packId;
        if (!existingPack) {
          // Create new pack
          const result = await db.run(`
            INSERT INTO packs (name, description, game_focus, is_public)
            VALUES (?, ?, ?, 1)
          `, [packData.name, packData.description, packData.game_focus]);
          
          packId = result.lastID;
          createdPacks++;
          console.log(`Created pack: ${packData.name}`);
        } else {
          packId = existingPack.id;
          console.log(`Pack already exists: ${packData.name}`);
        }

        // Add tasks to pack
        for (const taskName of packData.tasks) {
          // Find or create task
          await db.run(`INSERT OR IGNORE INTO tasks (name) VALUES (?)`, [taskName]);
          const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);
          
          if (task) {
            // Add task to pack
            await db.run(`INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`, [packId, task.id]);
            addedTasks++;
          }
        }
      }

      console.log(`Pack initialization complete: ${createdPacks} packs created, ${addedTasks} tasks linked`);
      return { createdPacks, addedTasks };
      
    } catch (error) {
      console.error('Pack initialization failed:', error);
      return { createdPacks: 0, addedTasks: 0, error: error.message };
    }
  },

  // Get tasks for a specific pack
  async getPackTasks(db, packId) {
    try {
      const tasks = await db.all(`
        SELECT t.*, pt.added_at
        FROM tasks t
        JOIN pack_tasks pt ON t.id = pt.task_id
        WHERE pt.pack_id = ?
        ORDER BY pt.added_at
      `, [packId]);
      
      return tasks;
    } catch (error) {
      console.error('Failed to get pack tasks:', error);
      return [];
    }
  },

  // Create a custom pack
  async createCustomPack(db, packData) {
    try {
      const result = await db.run(`
        INSERT INTO packs (name, description, game_focus, is_public)
        VALUES (?, ?, ?, 0)
      `, [packData.name, packData.description || '', packData.game_focus || 'Custom']);
      
      const packId = result.lastID;
      
      // Add tasks to pack
      if (packData.tasks && Array.isArray(packData.tasks)) {
        for (const taskName of packData.tasks) {
          await db.run(`INSERT OR IGNORE INTO tasks (name) VALUES (?)`, [taskName]);
          const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);
          
          if (task) {
            await db.run(`INSERT OR IGNORE INTO pack_tasks (pack_id, task_id) VALUES (?, ?)`, [packId, task.id]);
          }
        }
      }
      
      return packId;
    } catch (error) {
      console.error('Failed to create custom pack:', error);
      return null;
    }
  },

  // Get statistics for a pack
  async getPackStats(db, packId, days = 30) {
    try {
      const stats = await db.get(`
        SELECT 
          COUNT(r.id) as total_runs,
          AVG(r.accuracy) as avg_accuracy,
          MAX(r.accuracy) as max_accuracy,
          AVG(r.score) as avg_score,
          MAX(r.score) as max_score,
          SUM(r.duration) as total_duration,
          COUNT(DISTINCT r.task_id) as unique_tasks
        FROM runs r
        JOIN pack_tasks pt ON r.task_id = pt.task_id
        WHERE pt.pack_id = ?
        AND datetime(r.played_at) >= datetime('now', '-${days} days')
      `, [packId]);
      
      return stats;
    } catch (error) {
      console.error('Failed to get pack stats:', error);
      return null;
    }
  }
};

module.exports = packs;
