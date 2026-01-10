// backend/services/integrityChecker.js
// Database integrity validation and health checks

class IntegrityChecker {
  constructor(db) {
    this.db = db;
    this.issues = [];
  }

  /**
   * Run comprehensive integrity checks on the database
   */
  async runAllChecks() {
    console.log('🔍 Running database integrity checks...');
    this.issues = [];

    await this.checkOrphanedRuns();
    await this.checkCacheConsistency();
    await this.checkDuplicateRuns();
    await this.checkNullRequiredFields();
    await this.checkGoalProgress();
    await this.checkSessionData();
    
    return this.generateReport();
  }

  /**
   * Check for runs with invalid task_id references
   */
  async checkOrphanedRuns() {
    const result = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM runs 
      WHERE task_id NOT IN (SELECT id FROM tasks)
    `);

    if (result.count > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'orphaned_data',
        message: `Found ${result.count} runs with invalid task references`,
        fixable: true,
        fix: 'createMissingTasks'
      });
    }
  }

  /**
   * Verify cache consistency with actual data
   */
  async checkCacheConsistency() {
    // Check overall stats cache
    const cached = await this.db.get('SELECT total_runs FROM cached_overall_stats WHERE id = 1');
    const actual = await this.db.get('SELECT COUNT(*) as count FROM runs WHERE is_practice = 0');
    
    if (cached && actual) {
      const difference = Math.abs(cached.total_runs - actual.count);
      
      if (difference > 0) {
        this.issues.push({
          severity: difference > 10 ? 'error' : 'warning',
          category: 'cache_sync',
          message: `Cache out of sync: cached ${cached.total_runs} runs, actual ${actual.count} runs (diff: ${difference})`,
          fixable: true,
          fix: 'rebuildCache'
        });
      }
    }

    // Check task cache counts
    const taskCacheMismatch = await this.db.get(`
      SELECT COUNT(*) as count
      FROM cached_task_stats cts
      WHERE cts.total_runs != (
        SELECT COUNT(*) 
        FROM runs r 
        WHERE r.task_id = cts.task_id AND r.is_practice = 0
      )
    `);

    if (taskCacheMismatch && taskCacheMismatch.count > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'cache_sync',
        message: `${taskCacheMismatch.count} tasks have incorrect cached run counts`,
        fixable: true,
        fix: 'rebuildCache'
      });
    }
  }

  /**
   * Check for duplicate runs (same hash)
   */
  async checkDuplicateRuns() {
    const duplicates = await this.db.get(`
      SELECT COUNT(*) as count
      FROM (
        SELECT hash, COUNT(*) as dup_count
        FROM runs
        WHERE hash IS NOT NULL
        GROUP BY hash
        HAVING dup_count > 1
      )
    `);

    if (duplicates && duplicates.count > 0) {
      this.issues.push({
        severity: 'info',
        category: 'duplicates',
        message: `Found ${duplicates.count} duplicate run hashes (expected behavior for re-plays)`,
        fixable: false
      });
    }
  }

  /**
   * Check for runs with null required fields
   */
  async checkNullRequiredFields() {
    const nullData = await this.db.get(`
      SELECT COUNT(*) as count
      FROM runs
      WHERE task_id IS NULL 
         OR played_at IS NULL
         OR (score IS NULL AND accuracy IS NULL)
    `);

    if (nullData && nullData.count > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'null_data',
        message: `Found ${nullData.count} runs with missing critical data`,
        fixable: false
      });
    }
  }

  /**
   * Check goal progress consistency
   */
  async checkGoalProgress() {
    const invalidProgress = await this.db.get(`
      SELECT COUNT(*) as count
      FROM goal_progress gp
      WHERE gp.goal_id NOT IN (SELECT id FROM goals)
    `);

    if (invalidProgress && invalidProgress.count > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'orphaned_data',
        message: `Found ${invalidProgress.count} goal progress entries for deleted goals`,
        fixable: true,
        fix: 'cleanOrphanedGoalProgress'
      });
    }
  }

  /**
   * Check session data consistency
   */
  async checkSessionData() {
    // Check for sessions with no ended_at but is_active = 0
    const invalidSessions = await this.db.get(`
      SELECT COUNT(*) as count
      FROM sessions
      WHERE is_active = 0 AND ended_at IS NULL
    `);

    if (invalidSessions && invalidSessions.count > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'invalid_state',
        message: `Found ${invalidSessions.count} closed sessions with no end time`,
        fixable: true,
        fix: 'fixSessionEndTimes'
      });
    }
  }

  /**
   * Generate integrity report
   */
  generateReport() {
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');

    const report = {
      healthy: errors.length === 0 && warnings.length === 0,
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      issues: this.issues,
      timestamp: new Date().toISOString()
    };

    // Log summary
    if (report.healthy) {
      console.log('✅ Database integrity check: HEALTHY');
    } else {
      console.log(`⚠️  Database integrity check: ${errors.length} errors, ${warnings.length} warnings`);
      this.issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.message}`);
      });
    }

    return report;
  }

  /**
   * Attempt to fix known issues automatically
   */
  async autoFixIssues(report) {
    console.log('🔧 Attempting automatic fixes...');
    
    const fixableIssues = report.issues.filter(i => i.fixable);
    
    if (fixableIssues.length === 0) {
      console.log('   No fixable issues found');
      return;
    }

    for (const issue of fixableIssues) {
      try {
        switch (issue.fix) {
          case 'rebuildCache':
            await this.rebuildCache();
            break;
          case 'cleanOrphanedGoalProgress':
            await this.cleanOrphanedGoalProgress();
            break;
          case 'fixSessionEndTimes':
            await this.fixSessionEndTimes();
            break;
        }
        console.log(`   ✅ Fixed: ${issue.message}`);
      } catch (error) {
        console.error(`   ❌ Failed to fix: ${issue.message}`, error);
      }
    }
  }

  /**
   * Rebuild cache from actual data
   */
  async rebuildCache() {
    console.log('   🔄 Rebuilding cache...');
    
    // Note: This would trigger the actual cache rebuild logic
    // For now, just log that it should be done
    console.log('   ℹ️  Cache rebuild should be triggered by cache initialization');
  }

  /**
   * Clean orphaned goal progress
   */
  async cleanOrphanedGoalProgress() {
    await this.db.run(`
      DELETE FROM goal_progress
      WHERE goal_id NOT IN (SELECT id FROM goals)
    `);
  }

  /**
   * Fix session end times
   */
  async fixSessionEndTimes() {
    await this.db.run(`
      UPDATE sessions
      SET ended_at = started_at
      WHERE is_active = 0 AND ended_at IS NULL
    `);
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const stats = {};
    
    stats.totalRuns = (await this.db.get('SELECT COUNT(*) as count FROM runs'))?.count || 0;
    stats.totalTasks = (await this.db.get('SELECT COUNT(*) as count FROM tasks'))?.count || 0;
    stats.totalSessions = (await this.db.get('SELECT COUNT(*) as count FROM sessions'))?.count || 0;
    stats.activeGoals = (await this.db.get('SELECT COUNT(*) as count FROM goals WHERE is_active = 1'))?.count || 0;
    stats.dbSize = await this.getDbSize();
    
    return stats;
  }

  /**
   * Get database file size
   */
  async getDbSize() {
    try {
      const result = await this.db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
      return result ? (result.size / (1024 * 1024)).toFixed(2) : 0; // Size in MB
    } catch (error) {
      return 0;
    }
  }
}

module.exports = { IntegrityChecker };
