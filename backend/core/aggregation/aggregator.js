// backend/core/aggregation/aggregator.js
// Core aggregation engine for comparison calculations
const { resolveWindow } = require('../../utils/time');

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray, p) {
    if (!sortedArray || sortedArray.length === 0) return null;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
}

/**
 * Aggregate runs within a time window with optional task filtering
 * @param {Object} db - Database instance
 * @param {Object} options - Aggregation options
 * @param {string} options.startTime - ISO timestamp
 * @param {string} options.endTime - ISO timestamp
 * @param {number[]} options.taskIds - Optional array of task IDs to filter
 * @returns {Promise<Object>} Aggregated statistics
 */
async function aggregateRuns(db, { startTime, endTime, taskIds }) {
    const where = ['r.played_at >= ?', 'r.played_at <= ?'];
    const params = [startTime, endTime];

    if (taskIds && taskIds.length > 0) {
        where.push(`r.task_id IN (${taskIds.map(() => '?').join(',')})`);
        params.push(...taskIds);
    }

    const whereClause = where.join(' AND ');

    // Overall statistics
    const overall = await db.get(`
        SELECT 
            COUNT(*) as count,
            AVG(r.score) as avg_score,
            AVG(r.accuracy) as avg_accuracy,
            AVG(r.avg_ttk) as avg_ttk,
            SUM(r.duration) as total_duration,
            COUNT(DISTINCT r.task_id) as unique_tasks
        FROM runs r
        WHERE ${whereClause}
    `, params);

    // Fetch all runs for percentile calculation
    const allRuns = await db.all(`
        SELECT score, accuracy, avg_ttk
        FROM runs r
        WHERE ${whereClause}
        ORDER BY score
    `, params);

    // Calculate percentiles in JavaScript (SQLite doesn't have native percentiles)
    const scores = allRuns.map(r => r.score).filter(s => s != null).sort((a, b) => a - b);
    const accuracies = allRuns.map(r => r.accuracy).filter(a => a != null).sort((a, b) => a - b);
    const ttks = allRuns.map(r => r.avg_ttk).filter(t => t != null).sort((a, b) => a - b);

    const percentiles = {
        score_p50: percentile(scores, 0.5),
        score_p95: percentile(scores, 0.95),
        accuracy_p50: percentile(accuracies, 0.5),
        accuracy_p95: percentile(accuracies, 0.95),
        ttk_p50: percentile(ttks, 0.5),
        ttk_p95: percentile(ttks, 0.95),
    };

    // Task breakdown
    const byTask = await db.all(`
        SELECT 
            t.id as task_id,
            t.name as task_name,
            COUNT(*) as count,
            AVG(r.score) as avg_score,
            AVG(r.accuracy) as avg_accuracy,
            AVG(r.avg_ttk) as avg_ttk,
            MAX(r.score) as max_score,
            MIN(r.score) as min_score
        FROM runs r
        JOIN tasks t ON t.id = r.task_id
        WHERE ${whereClause}
        GROUP BY t.id
        ORDER BY t.name
    `, params);

    // Determine appropriate bucket size based on time span
    const span = (new Date(endTime) - new Date(startTime)) / 1000; // seconds
    const bucketFormat = span > 7 * 86400 ? '%Y-%m-%d' : '%Y-%m-%d %H:00:00';

    // Trend series (time-bucketed averages)
    const trend = await db.all(`
        SELECT 
            strftime('${bucketFormat}', r.played_at) as bucket,
            AVG(r.score) as avg_score,
            AVG(r.accuracy) as avg_accuracy,
            AVG(r.avg_ttk) as avg_ttk,
            COUNT(*) as count
        FROM runs r
        WHERE ${whereClause}
        GROUP BY bucket
        ORDER BY bucket
    `, params);

    return {
        overall: { ...overall, ...percentiles },
        byTask,
        trend,
        meta: {
            startTime,
            endTime,
            taskFilter: taskIds ? taskIds.length : null
        }
    };
}

/**
 * Get top runs for a specific task within a time window
 * @param {Object} db - Database instance
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Top runs
 */
async function getTopRunsForTask(db, { startTime, endTime, taskId, limit = 3, sortBy = 'score' }) {
    const validSortFields = ['score', 'accuracy', 'avg_ttk'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'score';
    const sortOrder = sortBy === 'avg_ttk' ? 'ASC' : 'DESC'; // Lower TTK is better

    const runs = await db.all(`
        SELECT 
            r.id,
            r.score,
            r.accuracy,
            r.avg_ttk,
            r.duration,
            r.played_at,
            t.name as task_name
        FROM runs r
        JOIN tasks t ON t.id = r.task_id
        WHERE r.played_at >= ?
            AND r.played_at <= ?
            AND r.task_id = ?
            AND r.${sortField} IS NOT NULL
        ORDER BY r.${sortField} ${sortOrder}
        LIMIT ?
    `, [startTime, endTime, taskId, limit]);

    return runs;
}

/**
 * Compare two aggregated datasets and compute diffs
 * @param {Object} left - Left window aggregation
 * @param {Object} right - Right window aggregation
 * @returns {Object} Comparison with diffs
 */
function compareAggregations(left, right) {
    // Compute overall diffs (right - left, so positive = improvement in right/newer value)
    const diffs = {
        score: right.overall.avg_score - left.overall.avg_score,
        scorePct: left.overall.avg_score ? ((right.overall.avg_score / left.overall.avg_score - 1) * 100) : null,
        accuracy: right.overall.avg_accuracy - left.overall.avg_accuracy,
        accuracyPct: left.overall.avg_accuracy ? ((right.overall.avg_accuracy / left.overall.avg_accuracy - 1) * 100) : null,
        ttk: right.overall.avg_ttk - left.overall.avg_ttk,
        ttkPct: left.overall.avg_ttk ? ((right.overall.avg_ttk / left.overall.avg_ttk - 1) * 100) : null,
    };

    // Find shared tasks
    const leftTaskIds = new Set(left.byTask.map(t => t.task_id));
    const rightTaskIds = new Set(right.byTask.map(t => t.task_id));
    const sharedTaskIds = [...leftTaskIds].filter(id => rightTaskIds.has(id));

    // Per-task comparisons for shared tasks
    const taskComparisons = sharedTaskIds.map(taskId => {
        const l = left.byTask.find(t => t.task_id === taskId);
        const r = right.byTask.find(t => t.task_id === taskId);

        return {
            taskId,
            taskName: l.task_name,
            left: {
                count: l.count,
                avgScore: l.avg_score,
                avgAccuracy: l.avg_accuracy,
                avgTtk: l.avg_ttk,
            },
            right: {
                count: r.count,
                avgScore: r.avg_score,
                avgAccuracy: r.avg_accuracy,
                avgTtk: r.avg_ttk,
            },
            diff: {
                score: r.avg_score - l.avg_score,
                scorePct: l.avg_score ? ((r.avg_score / l.avg_score - 1) * 100) : null,
                accuracy: r.avg_accuracy - l.avg_accuracy,
                accuracyPct: l.avg_accuracy ? ((r.avg_accuracy / l.avg_accuracy - 1) * 100) : null,
                ttk: r.avg_ttk - l.avg_ttk,
                ttkPct: l.avg_ttk ? ((r.avg_ttk / l.avg_ttk - 1) * 100) : null,
            }
        };
    });

    return {
        overall: {
            left: left.overall,
            right: right.overall,
            diffs
        },
        tasks: taskComparisons,
        trend: {
            left: left.trend,
            right: right.trend
        },
        meta: {
            hasSharedTasks: sharedTaskIds.length > 0,
            sharedTaskCount: sharedTaskIds.length,
            leftRunCount: left.overall.count,
            rightRunCount: right.overall.count,
            leftTaskCount: left.byTask.length,
            rightTaskCount: right.byTask.length
        }
    };
}

module.exports = {
    aggregateRuns,
    getTopRunsForTask,
    compareAggregations,
    resolveWindow
};
