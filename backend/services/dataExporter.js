// backend/services/dataExporter.js
// Data export and import functionality

const fs = require('fs');
const path = require('path');

class DataExporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Export all data to JSON format
   */
  async exportToJSON(outputPath) {
    console.log('📤 Exporting data to JSON...');
    
    try {
      // Fetch all data first
      const data = {
        runs: await this.db.all('SELECT * FROM runs ORDER BY played_at'),
        tasks: await this.db.all('SELECT * FROM tasks ORDER BY id'),
        goals: await this.db.all('SELECT * FROM goals ORDER BY id'),
        goal_progress: await this.db.all('SELECT * FROM goal_progress ORDER BY goal_id'),
        sessions: await this.db.all('SELECT * FROM sessions ORDER BY started_at'),
        packs: await this.db.all('SELECT * FROM packs ORDER BY id'),
        pack_tasks: await this.db.all('SELECT * FROM pack_tasks ORDER BY pack_id, task_id')
      };

      // Build export object with calculated stats
      const exportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: data,
        stats: {
          total_runs: data.runs.length,
          total_tasks: data.tasks.length,
          total_sessions: data.sessions.length,
          total_goals: data.goals.length
        }
      };

      await fs.promises.writeFile(
        outputPath,
        JSON.stringify(exportData, null, 2),
        'utf8'
      );

      console.log(`✅ Export complete: ${outputPath}`);
      console.log(`   📊 Exported: ${exportData.stats.total_runs} runs, ${exportData.stats.total_tasks} tasks`);
      
      return exportData.stats;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  /**
   * Export data to CSV format (runs only)
   */
  async exportRunsToCSV(outputPath) {
    console.log('📤 Exporting runs to CSV...');
    
    try {
      const runs = await this.db.all(`
        SELECT 
          r.id,
          t.name as task_name,
          r.played_at,
          r.score,
          r.accuracy,
          r.hits,
          r.shots,
          r.duration,
          r.avg_ttk,
          r.overshots,
          r.reloads,
          r.fps_avg,
          r.is_practice
        FROM runs r
        JOIN tasks t ON r.task_id = t.id
        ORDER BY r.played_at
      `);

      // Create CSV header
      const header = [
        'id', 'task_name', 'played_at', 'score', 'accuracy', 
        'hits', 'shots', 'duration', 'avg_ttk', 'overshots', 
        'reloads', 'fps_avg', 'is_practice'
      ];

      // Create CSV rows
      const rows = runs.map(run => 
        header.map(col => {
          const value = run[col];
          // Handle null/undefined
          if (value === null || value === undefined) return '';
          // Quote strings with commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );

      const csv = [header.join(','), ...rows].join('\n');

      await fs.promises.writeFile(outputPath, csv, 'utf8');

      console.log(`✅ CSV export complete: ${outputPath}`);
      console.log(`   📊 Exported: ${runs.length} runs`);
      
      return { total_runs: runs.length };
    } catch (error) {
      console.error('❌ CSV export failed:', error);
      throw error;
    }
  }

  /**
   * Import data from JSON export
   */
  async importFromJSON(inputPath, options = {}) {
    console.log('📥 Importing data from JSON...');
    
    try {
      const fileContent = await fs.promises.readFile(inputPath, 'utf8');
      const importData = JSON.parse(fileContent);

      if (!importData.data) {
        throw new Error('Invalid export format');
      }

      const TransactionManager = require('./transactionManager');
      const txManager = new TransactionManager(this.db);

      const results = await txManager.safeImport(importData.data);

      console.log(`✅ Import complete`);
      console.log(`   📊 Imported: ${results.runs} runs, ${results.tasks} tasks`);
      
      if (results.errors.length > 0) {
        console.log(`   ⚠️  ${results.errors.length} errors encountered`);
      }

      return results;
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Export specific date range
   */
  async exportDateRange(startDate, endDate, outputPath) {
    console.log(`📤 Exporting runs from ${startDate} to ${endDate}...`);
    
    const runs = await this.db.all(
      'SELECT * FROM runs WHERE played_at BETWEEN ? AND ? ORDER BY played_at',
      [startDate, endDate]
    );

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      date_range: { start: startDate, end: endDate },
      data: { runs }
    };

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(exportData, null, 2),
      'utf8'
    );

    console.log(`✅ Date range export complete: ${runs.length} runs`);
    return { total_runs: runs.length };
  }

  /**
   * Get export statistics without exporting
   */
  async getExportStats() {
    const stats = {
      total_runs: (await this.db.get('SELECT COUNT(*) as count FROM runs'))?.count || 0,
      total_tasks: (await this.db.get('SELECT COUNT(*) as count FROM tasks'))?.count || 0,
      total_sessions: (await this.db.get('SELECT COUNT(*) as count FROM sessions'))?.count || 0,
      total_goals: (await this.db.get('SELECT COUNT(*) as count FROM goals'))?.count || 0,
      oldest_run: (await this.db.get('SELECT MIN(played_at) as date FROM runs'))?.date,
      newest_run: (await this.db.get('SELECT MAX(played_at) as date FROM runs'))?.date
    };

    return stats;
  }
}

module.exports = { DataExporter };
