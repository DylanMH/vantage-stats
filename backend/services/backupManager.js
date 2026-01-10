// backend/services/backupManager.js
// Automatic database backup system

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class BackupManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.backupDir = path.join(path.dirname(dbPath), 'backups');
    this.maxBackups = 30; // Keep last 30 backups
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the database
   * Returns the backup file path
   */
  async createBackup(reason = 'manual') {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupFileName = `vantage-${reason}-${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      console.log(`📦 Creating backup: ${backupFileName}`);

      // Copy database file
      await fs.promises.copyFile(this.dbPath, backupPath);

      // Clean old backups
      await this.cleanOldBackups();

      console.log(`✅ Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  /**
   * Create automatic daily backup if needed
   */
  async createDailyBackupIfNeeded() {
    const backups = await this.listBackups();
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have a backup today
    const hasTodayBackup = backups.some(backup => {
      const backupDate = this.extractDateFromFilename(backup);
      return backupDate === today;
    });

    if (!hasTodayBackup) {
      console.log('🕐 Creating daily backup...');
      await this.createBackup('daily');
    } else {
      console.log('✅ Daily backup already exists');
    }
  }

  /**
   * Create backup before risky operations
   */
  async createSafetyBackup(operation = 'operation') {
    return await this.createBackup(`pre-${operation}`);
  }

  /**
   * List all available backups
   */
  async listBackups() {
    try {
      const files = await fs.promises.readdir(this.backupDir);
      const backups = files
        .filter(f => f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(this.backupDir, f);
          const stats = fs.statSync(fullPath);
          return {
            filename: f,
            path: fullPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Remove old backups, keeping only the most recent ones
   */
  async cleanOldBackups() {
    try {
      const backups = await this.listBackups();
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
        for (const backup of toDelete) {
          await fs.promises.unlink(backup.path);
          console.log(`🗑️ Deleted old backup: ${backup.filename}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupPath) {
    try {
      console.log(`🔄 Restoring from backup: ${backupPath}`);

      // Create safety backup before restore
      await this.createBackup('pre-restore');

      // Verify backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Close current database connection first (handled by caller)
      
      // Replace database with backup
      await fs.promises.copyFile(backupPath, this.dbPath);

      console.log('✅ Database restored successfully');
      return true;
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    return {
      count: backups.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestBackup: backups[backups.length - 1],
      newestBackup: backups[0]
    };
  }

  /**
   * Extract date from backup filename
   */
  extractDateFromFilename(backup) {
    // Format: vantage-daily-2026-01-10T15-30-00.db
    const match = backup.filename.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  /**
   * Schedule automatic daily backups
   */
  scheduleAutomaticBackups() {
    // Check for daily backup on startup
    this.createDailyBackupIfNeeded();

    // Schedule daily backup check (every 6 hours)
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(() => {
      this.createDailyBackupIfNeeded();
    }, SIX_HOURS);

    console.log('📅 Automatic backup scheduler started');
  }
}

module.exports = { BackupManager };
