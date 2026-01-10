// backend/services/cacheManager.js
// Performance caching service for stats aggregation

class CacheManager {
    constructor(db) {
        this.db = db;
    }

    // Initialize cache with existing data
    async initializeCache() {
        console.log('🔄 Initializing performance cache...');
        
        await this.updateOverallStats();
        await this.updateAllTaskStats();
        await this.updateTimeStats();
        
        console.log('✅ Cache initialization complete');
    }

    // Update overall stats (called when new runs are added)
    async updateOverallStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_runs,
                COUNT(DISTINCT task_id) as unique_tasks,
                CASE 
                    WHEN AVG(accuracy) <= 1 THEN AVG(accuracy) * 100
                    ELSE AVG(accuracy)
                END as avg_accuracy,
                MAX(CASE 
                    WHEN accuracy <= 1 THEN accuracy * 100
                    ELSE accuracy
                END) as max_accuracy,
                AVG(score) as avg_score,
                MAX(score) as max_score,
                AVG(duration) as avg_duration,
                SUM(duration) as total_duration,
                AVG(avg_ttk) as avg_ttk,
                AVG(shots) as avg_shots,
                SUM(shots) as total_shots,
                AVG(overshots) as avg_overshots,
                AVG(reloads) as avg_reload_count,
                AVG(fps_avg) as avg_fps
            FROM runs 
            WHERE is_practice = 0
        `);

        if (stats) {
            await this.db.run(`
                UPDATE cached_overall_stats SET
                    total_runs = ?,
                    unique_tasks = ?,
                    avg_accuracy = COALESCE(?, 0),
                    max_accuracy = COALESCE(?, 0),
                    avg_score = COALESCE(?, 0),
                    max_score = COALESCE(?, 0),
                    avg_duration = COALESCE(?, 0),
                    total_duration = COALESCE(?, 0),
                    avg_ttk = COALESCE(?, 0),
                    avg_shots = COALESCE(?, 0),
                    total_shots = COALESCE(?, 0),
                    avg_overshots = COALESCE(?, 0),
                    avg_reload_count = COALESCE(?, 0),
                    avg_fps = COALESCE(?, 0),
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = 1
            `, [
                stats.total_runs,
                stats.unique_tasks,
                stats.avg_accuracy,
                stats.max_accuracy,
                stats.avg_score,
                stats.max_score,
                stats.avg_duration,
                stats.total_duration,
                stats.avg_ttk,
                stats.avg_shots,
                stats.total_shots,
                stats.avg_overshots,
                stats.avg_reload_count,
                stats.avg_fps
            ]);
        }
    }

    // Update stats for a specific task (called when new run is added)
    async updateTaskStats(taskId) {
        const stats = await this.db.get(`
            SELECT 
                t.name as task_name,
                COUNT(*) as total_runs,
                CASE 
                    WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                    ELSE AVG(r.accuracy)
                END as avg_accuracy,
                MAX(CASE 
                    WHEN r.accuracy <= 1 THEN r.accuracy * 100
                    ELSE r.accuracy
                END) as max_accuracy,
                AVG(r.score) as avg_score,
                MAX(r.score) as max_score,
                AVG(r.avg_ttk) as avg_ttk,
                AVG(r.duration) as avg_duration,
                SUM(r.duration) as total_duration,
                AVG(r.shots) as avg_shots,
                SUM(r.shots) as total_shots,
                MAX(r.score) as best_score,
                MAX(CASE 
                    WHEN r.accuracy <= 1 THEN r.accuracy * 100
                    ELSE r.accuracy
                END) as best_accuracy,
                MAX(r.played_at) as last_played
            FROM runs r
            JOIN tasks t ON r.task_id = t.id
            WHERE r.task_id = ? AND r.is_practice = 0
            GROUP BY r.task_id, t.name
        `, [taskId]);

        if (stats) {
            // Calculate recent average (last 10 runs)
            const recentStats = await this.db.get(`
                SELECT 
                    CASE 
                        WHEN AVG(accuracy) <= 1 THEN AVG(accuracy) * 100
                        ELSE AVG(accuracy)
                    END as recent_avg_accuracy
                FROM runs 
                WHERE task_id = ? AND is_practice = 0
                ORDER BY played_at DESC
                LIMIT 10
            `, [taskId]);

            await this.db.run(`
                INSERT OR REPLACE INTO cached_task_stats (
                    task_id, task_name, total_runs, avg_accuracy, max_accuracy,
                    avg_score, max_score, avg_ttk, avg_duration, total_duration,
                    avg_shots, total_shots, recent_avg_accuracy, best_score,
                    best_accuracy, last_played, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                taskId,
                stats.task_name,
                stats.total_runs,
                stats.avg_accuracy,
                stats.max_accuracy,
                stats.avg_score,
                stats.max_score,
                stats.avg_ttk,
                stats.avg_duration,
                stats.total_duration,
                stats.avg_shots,
                stats.total_shots,
                recentStats?.recent_avg_accuracy || 0,
                stats.best_score,
                stats.best_accuracy,
                stats.last_played
            ]);
        }
    }

    // Update all task stats (for initialization)
    async updateAllTaskStats() {
        const tasks = await this.db.all(`
            SELECT DISTINCT task_id FROM runs WHERE is_practice = 0
        `);

        for (const task of tasks) {
            await this.updateTaskStats(task.task_id);
        }
    }

    // Update time-based stats
    async updateTimeStats() {
        const { daysAgoIso } = require('../utils/time');
        
        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const timePeriods = [
            { period: 'today', condition: `datetime(r.played_at) >= datetime(?)`, params: [today.toISOString()] },
            { period: '7days', condition: `datetime(r.played_at) >= datetime(?)`, params: [daysAgoIso(7)] },
            { period: '30days', condition: `datetime(r.played_at) >= datetime(?)`, params: [daysAgoIso(30)] },
            { period: 'all', condition: '1=1', params: [] }
        ];

        for (const { period, condition, params } of timePeriods) {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as total_runs,
                    COUNT(DISTINCT r.task_id) as unique_tasks,
                    CASE 
                        WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                        ELSE AVG(r.accuracy)
                    END as avg_accuracy,
                    AVG(r.score) as avg_score,
                    AVG(r.duration) as avg_duration
                FROM runs r
                WHERE r.is_practice = 0 AND ${condition}
            `, params);

            const bestTask = await this.db.get(`
                SELECT 
                    t.name as task_name,
                    CASE 
                        WHEN AVG(r.accuracy) <= 1 THEN AVG(r.accuracy) * 100
                        ELSE AVG(r.accuracy)
                    END as avg_accuracy,
                    MAX(r.score) as max_score
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                WHERE r.is_practice = 0 AND ${condition}
                GROUP BY r.task_id, t.name
                HAVING COUNT(*) >= 5
                ORDER BY avg_accuracy DESC
                LIMIT 1
            `, params);

            await this.db.run(`
                UPDATE cached_time_stats SET
                    total_runs = ?,
                    unique_tasks = ?,
                    avg_accuracy = COALESCE(?, 0),
                    avg_score = COALESCE(?, 0),
                    avg_duration = COALESCE(?, 0),
                    best_task_name = ?,
                    best_task_accuracy = COALESCE(?, 0),
                    best_task_score = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE time_period = ?
            `, [
                stats?.total_runs || 0,
                stats?.unique_tasks || 0,
                stats?.avg_accuracy || 0,
                stats?.avg_score || 0,
                stats?.avg_duration || 0,
                bestTask?.task_name || null,
                bestTask?.avg_accuracy || 0,
                bestTask?.max_score || null,
                period
            ]);
        }
    }

    // Get cached overall stats
    async getOverallStats() {
        return await this.db.get('SELECT * FROM cached_overall_stats WHERE id = 1');
    }

    // Get cached task stats
    async getTaskStats(taskId) {
        return await this.db.get('SELECT * FROM cached_task_stats WHERE task_id = ?', [taskId]);
    }

    // Get cached time stats
    async getTimeStats(period) {
        return await this.db.get('SELECT * FROM cached_time_stats WHERE time_period = ?', [period]);
    }

    // Validate cache integrity (optional, for debugging)
    async validateCache() {
        console.log('🔍 Validating cache integrity...');
        
        // Compare overall stats
        const cached = await this.getOverallStats();
        const calculated = await this.db.get(`
            SELECT COUNT(*) as total_runs, AVG(accuracy) as avg_accuracy 
            FROM runs WHERE is_practice = 0
        `);

        if (cached && calculated) {
            const accuracyDiff = Math.abs((cached.avg_accuracy || 0) - (calculated.avg_accuracy || 0));
            if (accuracyDiff > 0.01) {
                console.warn('⚠️ Cache validation failed - recalculating');
                await this.updateOverallStats();
            } else {
                console.log('✅ Cache validation passed');
            }
        }
    }
}

module.exports = CacheManager;
