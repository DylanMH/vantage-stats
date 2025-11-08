// backend/goals.js
const { getSettingBoolean } = require('./settings');

const goals = {
  // Generate simple overall performance goals (not task-specific)
  async generateGoals(db) {
    try {
      // Check if initial scan is complete
      const scanComplete = await getSettingBoolean(db, 'initial_scan_complete', false);
      if (!scanComplete) {
        console.log('⏸️  Goal generation skipped - waiting for initial scan to complete');
        return { generated: 0, reason: 'initial_scan_incomplete' };
      }

      // Check if user has enough runs for goal generation
      const runCount = await db.get(`SELECT COUNT(*) as count FROM runs`);
      if (runCount.count < 10) {
        console.log('Not enough runs for goal generation (need 10+, have', runCount.count, ')');
        return { generated: 0, reason: 'insufficient_runs' };
      }

      // Check existing active goals to avoid duplicates
      const existingGoals = await db.all(`
        SELECT g.goal_type 
        FROM goals g
        LEFT JOIN goal_progress gp ON g.id = gp.goal_id
        WHERE g.is_active = 1 AND (gp.is_completed = 0 OR gp.is_completed IS NULL)
      `);
      
      const existingTypes = new Set(existingGoals.map(g => g.goal_type));
      console.log('Existing active goal types:', Array.from(existingTypes));

      // Get overall performance stats
      const overallStats = await db.get(`
        SELECT 
          AVG(accuracy) as avg_accuracy,
          AVG(score) as avg_score,
          AVG(avg_ttk) as avg_ttk,
          COUNT(*) as total_runs
        FROM runs 
        WHERE accuracy IS NOT NULL AND score IS NOT NULL AND avg_ttk IS NOT NULL
      `);

      if (!overallStats || !overallStats.avg_accuracy) {
        console.log('No valid stats for goal generation');
        return { generated: 0, reason: 'no_stats' };
      }

      const generatedGoals = [];

      // 1. Overall Accuracy Goal (only if not exists)
      if (!existingTypes.has('accuracy') && overallStats.avg_accuracy < 95) {
        const targetAccuracy = Math.min(95, Math.round(overallStats.avg_accuracy + 5));
        const goalId = await this.createGoal(db, {
          title: `Improve Overall Accuracy`,
          description: `Increase your average accuracy across all tasks from ${overallStats.avg_accuracy.toFixed(1)}% to ${targetAccuracy}%`,
          goal_type: 'accuracy',
          target_value: targetAccuracy,
          target_task_id: null, // Overall, not task-specific
          target_timeframe: 30,
          is_auto_generated: 1
        });
        
        if (goalId) {
          await this.initializeGoalProgress(db, goalId, overallStats.avg_accuracy);
          generatedGoals.push({ type: 'accuracy', target: targetAccuracy });
        }
      }

      // 2. Overall Score Goal (only if not exists)
      if (!existingTypes.has('score') && overallStats.avg_score) {
        const targetScore = Math.round(overallStats.avg_score * 1.15); // 15% improvement
        const goalId = await this.createGoal(db, {
          title: `Boost Overall Score`,
          description: `Increase your average score across all tasks from ${Math.round(overallStats.avg_score)} to ${targetScore}`,
          goal_type: 'score',
          target_value: targetScore,
          target_task_id: null,
          target_timeframe: 30,
          is_auto_generated: 1
        });
        
        if (goalId) {
          await this.initializeGoalProgress(db, goalId, overallStats.avg_score);
          generatedGoals.push({ type: 'score', target: targetScore });
        }
      }

      // 3. Overall TTK Goal (lower is better, only if not exists)
      if (!existingTypes.has('ttk') && overallStats.avg_ttk && overallStats.avg_ttk > 0.5) {
        const targetTtk = (overallStats.avg_ttk * 0.9).toFixed(3); // 10% faster
        const goalId = await this.createGoal(db, {
          title: `Improve Reaction Speed`,
          description: `Decrease your average TTK across all tasks from ${overallStats.avg_ttk.toFixed(3)}s to ${targetTtk}s`,
          goal_type: 'ttk',
          target_value: parseFloat(targetTtk),
          target_task_id: null,
          target_timeframe: 30,
          is_auto_generated: 1
        });
        
        if (goalId) {
          await this.initializeGoalProgress(db, goalId, overallStats.avg_ttk);
          generatedGoals.push({ type: 'ttk', target: targetTtk });
        }
      }

      console.log(`Generated ${generatedGoals.length} new goals (avoiding duplicates):`, generatedGoals);
      return { generated: generatedGoals.length, goals: generatedGoals };
      
    } catch (error) {
      console.error('Goal generation failed:', error);
      return { generated: 0, error: error.message };
    }
  },

  async createGoal(db, goalData) {
    try {
      const result = await db.run(`
        INSERT INTO goals (title, description, goal_type, target_value, target_task_id, target_timeframe, is_auto_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        goalData.title,
        goalData.description,
        goalData.goal_type,
        goalData.target_value,
        goalData.target_task_id,
        goalData.target_timeframe,
        goalData.is_auto_generated
      ]);
      
      return result.lastID;
    } catch (error) {
      console.error('Failed to create goal:', error);
      return null;
    }
  },

  async initializeGoalProgress(db, goalId, currentValue) {
    try {
      await db.run(`
        INSERT OR IGNORE INTO goal_progress (goal_id, current_value)
        VALUES (?, ?)
      `, [goalId, currentValue || 0]);
    } catch (error) {
      console.error('Failed to initialize goal progress:', error);
    }
  },

  async getTaskId(db, taskName) {
    try {
      const task = await db.get(`SELECT id FROM tasks WHERE name = ?`, [taskName]);
      return task ? task.id : null;
    } catch (error) {
      console.error('Failed to get task ID:', error);
      return null;
    }
  },

  // Update goal progress when new runs are added
  async updateGoalProgress(db, runData) {
    try {
      const activeGoals = await db.all(`
        SELECT 
          g.*,
          gp.current_value,
          t.name as task_name
        FROM goals g
        LEFT JOIN goal_progress gp ON g.id = gp.goal_id
        LEFT JOIN tasks t ON g.target_task_id = t.id
        WHERE g.is_active = 1 AND (gp.is_completed = 0 OR gp.is_completed IS NULL)
      `);

      for (const goal of activeGoals) {
        let shouldUpdate = false;
        let newValue = goal.current_value;

        // For overall goals (no task_name), always update
        // For task-specific goals, only update if this run matches the task
        const isOverallGoal = !goal.task_name;
        const matchesTask = goal.task_name === runData.task_name;

        switch (goal.goal_type) {
          case 'accuracy':
            if (isOverallGoal || matchesTask) {
              // Get overall accuracy or task-specific
              const query = isOverallGoal 
                ? `SELECT AVG(accuracy) as avg_val FROM runs WHERE accuracy IS NOT NULL`
                : `SELECT AVG(accuracy) as avg_val FROM runs r
                   JOIN tasks t ON r.task_id = t.id
                   WHERE t.name = ? AND accuracy IS NOT NULL`;
              
              const result = await db.get(query, isOverallGoal ? [] : [goal.task_name]);
              
              if (result && result.avg_val != null) {
                newValue = result.avg_val;
                shouldUpdate = true;
              }
            }
            break;

          case 'score':
            if (isOverallGoal || matchesTask) {
              // Get overall score or task-specific
              const query = isOverallGoal 
                ? `SELECT AVG(score) as avg_val FROM runs WHERE score IS NOT NULL`
                : `SELECT AVG(score) as avg_val FROM runs r
                   JOIN tasks t ON r.task_id = t.id
                   WHERE t.name = ? AND score IS NOT NULL`;
              
              const result = await db.get(query, isOverallGoal ? [] : [goal.task_name]);
              
              if (result && result.avg_val != null) {
                newValue = result.avg_val;
                shouldUpdate = true;
              }
            }
            break;

          case 'ttk':
            if (isOverallGoal || matchesTask) {
              // Get overall TTK or task-specific
              const query = isOverallGoal 
                ? `SELECT AVG(avg_ttk) as avg_val FROM runs WHERE avg_ttk IS NOT NULL`
                : `SELECT AVG(avg_ttk) as avg_val FROM runs r
                   JOIN tasks t ON r.task_id = t.id
                   WHERE t.name = ? AND avg_ttk IS NOT NULL`;
              
              const result = await db.get(query, isOverallGoal ? [] : [goal.task_name]);
              
              if (result && result.avg_val != null) {
                newValue = result.avg_val;
                shouldUpdate = true;
              }
            }
            break;
        }

        if (shouldUpdate) {
          // For TTK (lower is better), completion is when newValue <= target
          // For others (higher is better), completion is when newValue >= target
          const isCompleted = goal.goal_type === 'ttk' 
            ? newValue <= goal.target_value
            : newValue >= goal.target_value;
            
          await db.run(`
            UPDATE goal_progress 
            SET current_value = ?, is_completed = ?, completed_at = ?, updated_at = datetime('now')
            WHERE goal_id = ?
          `, [
            newValue,
            isCompleted ? 1 : 0,
            isCompleted ? new Date().toISOString() : null,
            goal.id
          ]);

          if (isCompleted) {
            console.log(`Goal ${goal.id} (${goal.title}) completed!`);
            
            // Mark goal as inactive and generate a new one of the same type
            await db.run(`UPDATE goals SET is_active = 0 WHERE id = ?`, [goal.id]);
            
            // Auto-generate replacement goal
            console.log(`Generating replacement ${goal.goal_type} goal...`);
            const result = await this.generateGoals(db);
            console.log(`Replacement goal result:`, result);
          }
        }
      }

      return { success: true, updated: activeGoals.length };
    } catch (error) {
      console.error('Goal progress update failed:', error);
      return { success: false, error: error.message };
    }
  },
};

module.exports = goals;
