// backend/utils/ranked.js
/**
 * Ranked System Utilities
 * 
 * Purpose: Core logic for calculating ranked percentiles and ratings for competitive tasks.
 * 
 * Key Functions:
 * - scoreToPercentile: Converts a raw score to a percentile based on baseline cutoffs
 * - aggregateCategoryRating: Aggregates recent runs within a category to compute overall category rating
 * - computeOverallRating: Combines category ratings into a single overall rank
 * - getRankTier: Maps percentile/rating to a tier name with visual styling
 * 
 * Communicates With:
 * - Ranked routes API (provides calculation engine)
 * - Baselines JSON data (cutoff scores for percentile mapping)
 * - Database (retrieves user runs for aggregation)
 */

const fs = require('fs');
const path = require('path');

// Load ranked baselines data
const baselinesPath = path.join(__dirname, '..', 'ranked-baselines', 'baselines.json');
const top12Path = path.join(__dirname, '..', 'ranked-baselines', 'top12_by_category.json');

let baselinesData = null;
let top12Data = null;

/**
 * Load baselines data from JSON file
 * Contains cutoff scores for each percentile tier for all ranked tasks
 */
function loadBaselines() {
    if (!baselinesData) {
        const raw = fs.readFileSync(baselinesPath, 'utf8');
        baselinesData = JSON.parse(raw);
    }
    return baselinesData;
}

/**
 * Load top12 tasks by category
 * Contains the list of 12 ranked tasks per category (Flicking, Tracking, Target Switching)
 */
function loadTop12() {
    if (!top12Data) {
        const raw = fs.readFileSync(top12Path, 'utf8');
        top12Data = JSON.parse(raw);
    }
    return top12Data;
}

/**
 * Convert a raw score to percentile estimate based on baseline cutoffs
 * 
 * @param {number} leaderboardId - The task's leaderboard ID
 * @param {number} score - The user's score on this task
 * @returns {number|null} - Estimated percentile (0-1 scale), or null if task not found
 * 
 * Algorithm:
 * 1. Look up task cutoffs from baselines.json
 * 2. Find where the score sits between two adjacent cutoff percentiles
 * 3. Interpolate linearly to estimate the exact percentile
 * 
 * Example: If score is between 0.6 (1000 pts) and 0.8 (1200 pts) cutoffs,
 *          and user scored 1100, they're at ~0.7 percentile
 */
function scoreToPercentile(leaderboardId, score) {
    const baselines = loadBaselines();
    const taskKey = String(leaderboardId);
    const taskData = baselines.tasks[taskKey];
    
    if (!taskData || !taskData.cutoffs) {
        return null; // Task not in ranked pool
    }
    
    const cutoffs = taskData.cutoffs;
    const percentiles = Object.keys(cutoffs).map(Number).sort((a, b) => a - b);
    
    // Handle edge cases
    if (score <= cutoffs[percentiles[0]]) {
        return percentiles[0]; // At or below lowest cutoff
    }
    if (score >= cutoffs[percentiles[percentiles.length - 1]]) {
        return percentiles[percentiles.length - 1]; // At or above highest cutoff
    }
    
    // Find the two cutoffs that bracket this score
    for (let i = 0; i < percentiles.length - 1; i++) {
        const lowerPercentile = percentiles[i];
        const upperPercentile = percentiles[i + 1];
        const lowerScore = cutoffs[lowerPercentile];
        const upperScore = cutoffs[upperPercentile];
        
        if (score >= lowerScore && score <= upperScore) {
            // Linear interpolation between the two percentiles
            const scoreRange = upperScore - lowerScore;
            const percentileRange = upperPercentile - lowerPercentile;
            const scoreDelta = score - lowerScore;
            const percentile = lowerPercentile + (scoreDelta / scoreRange) * percentileRange;
            return percentile;
        }
    }
    
    return null; // Shouldn't reach here, but safety fallback
}

/**
 * Aggregate category rating from recent runs
 * 
 * @param {object} db - Database connection
 * @param {string} category - Category name (Flicking, Tracking, Target Switching)
 * @param {number} recentN - Number of recent runs to consider (default: 30)
 * @returns {object} - { rating, distinctTasks, totalRuns, isProvisional }
 * 
 * Algorithm:
 * 1. Get all ranked task IDs for this category
 * 2. Query user's recent runs for these tasks (non-practice only)
 * 3. Convert each run's score to percentile
 * 4. Compute median percentile as the category rating
 * 5. Mark as "provisional" if insufficient data (< 10 runs or < 3 distinct tasks)
 */
async function aggregateCategoryRating(db, category, recentN = 30) {
    const baselines = loadBaselines();
    
    // Find all leaderboard IDs for this category
    const categoryTasks = Object.values(baselines.tasks)
        .filter(task => task.category === category)
        .map(task => task.leaderboardId);
    
    if (categoryTasks.length === 0) {
        return { rating: null, distinctTasks: 0, totalRuns: 0, isProvisional: true };
    }
    
    // Get task IDs from database that match these leaderboard IDs
    const placeholders = categoryTasks.map(() => '?').join(',');
    const taskNames = Object.values(baselines.tasks)
        .filter(task => task.category === category)
        .map(task => task.scenarioName);
    
    const namePlaceholders = taskNames.map(() => '?').join(',');
    
    // First, get the ACTUAL total count of all ranked runs (not limited)
    const totalRunsResult = await db.get(`
        SELECT COUNT(*) as total_count
        FROM runs r
        JOIN tasks t ON r.task_id = t.id
        WHERE t.name IN (${namePlaceholders})
          AND r.is_practice = 0
          AND r.score IS NOT NULL
    `, taskNames);
    
    const actualTotalRuns = totalRunsResult?.total_count || 0;
    
    if (actualTotalRuns === 0) {
        return { rating: null, distinctTasks: 0, totalRuns: 0, isProvisional: true };
    }
    
    // Query recent runs for these tasks (non-practice only) - for rating calculation
    const runs = await db.all(`
        SELECT r.score, t.name
        FROM runs r
        JOIN tasks t ON r.task_id = t.id
        WHERE t.name IN (${namePlaceholders})
          AND r.is_practice = 0
          AND r.score IS NOT NULL
        ORDER BY r.played_at DESC
        LIMIT ?
    `, [...taskNames, recentN]);
    
    // Convert each run to percentile
    const percentiles = [];
    const distinctTasksSet = new Set();
    
    for (const run of runs) {
        // Find the task's leaderboard ID by matching scenario name
        const taskData = Object.values(baselines.tasks).find(
            task => task.scenarioName === run.name
        );
        
        if (taskData) {
            const percentile = scoreToPercentile(taskData.leaderboardId, run.score);
            if (percentile !== null) {
                percentiles.push(percentile);
                distinctTasksSet.add(run.name);
            }
        }
    }
    
    if (percentiles.length === 0) {
        return { rating: null, distinctTasks: 0, totalRuns: actualTotalRuns, isProvisional: true };
    }
    
    // Compute median percentile as rating
    percentiles.sort((a, b) => a - b);
    const mid = Math.floor(percentiles.length / 2);
    const median = percentiles.length % 2 === 0
        ? (percentiles[mid - 1] + percentiles[mid]) / 2
        : percentiles[mid];
    
    const distinctTasks = distinctTasksSet.size;
    const totalRuns = actualTotalRuns;
    
    // Gate: mark as provisional if insufficient data
    // Require at least 10 runs and 3 distinct tasks
    const isProvisional = totalRuns < 10 || distinctTasks < 3;
    
    return {
        rating: median,
        distinctTasks,
        totalRuns,
        isProvisional
    };
}

/**
 * Compute overall rating from category ratings
 * 
 * @param {object} categoryRatings - { Flicking, Tracking, 'Target Switching' }
 * @returns {object} - { overall, isProvisional }
 * 
 * MVP: Simple average of the three categories
 * Future: Weight by confidence (more plays + more distinct tasks)
 */
function computeOverallRating(categoryRatings) {
    const categories = ['Flicking', 'Tracking', 'Target Switching'];
    const validRatings = [];
    let anyProvisional = false;
    
    for (const cat of categories) {
        if (categoryRatings[cat] && categoryRatings[cat].rating !== null) {
            validRatings.push(categoryRatings[cat].rating);
            if (categoryRatings[cat].isProvisional) {
                anyProvisional = true;
            }
        }
    }
    
    // Don't compute overall rank until all 3 categories are established (non-provisional)
    // This prevents misleading global rank based on incomplete/provisional data
    if (validRatings.length < 3 || anyProvisional) {
        return { overall: null, isProvisional: true };
    }
    
    // All 3 categories present and established - compute average
    const overall = validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
    
    return { overall, isProvisional: false };
}

/**
 * Map percentile/rating to a rank tier with visual styling
 * 
 * Rank Tiers (from lowest to highest):
 * - Bronze: 0.0 - 0.2 (bottom 20%)
 * 
 * Point distribution:
 * - Bronze: 0-600 (0-20%)
 * - Silver: 600-1200 (20-40%)
 * - Gold: 1200-1800 (40-60%)
 * - Platinum: 1800-2400 (60-80%)
 * - Diamond: 2400-2700 (80-90%)
 * - Master: 2700-2910 (90-97%)
 * - Grandmaster: 2910-2970 (97-99%)
 * - Champion: 2970-3000 (99%+)
 */
function percentileToPoints(percentile) {
    if (percentile === null || percentile === undefined) {
        return null;
    }
    
    // Linear scaling: 0% = 0 points, 100% = 3000 points
    const points = Math.round(percentile * 3000);
    return Math.max(0, Math.min(3000, points));
}

/**
 * Get rank tier based on percentile
 * 
 * @param {number|null} percentile - Percentile value (0.0 to 1.0)
 * @returns {object} - { tier, color, gradient, textColor, minPoints, maxPoints }
 * 
 * Tier breakdown:
 * - Bronze: 0-20% (0-600 pts)
 * - Silver: 20-40% (600-1200 pts)
 * - Gold: 40-60% (1200-1800 pts)
 * - Platinum: 60-80% (1800-2400 pts)
 * - Diamond: 80-90% (2400-2700 pts)
 * - Master: 90-97% (2700-2910 pts)
 * - Grandmaster: 97-99% (2910-2970 pts)
 * - Champion: 99%+ (2970-3000 pts)
 */
function getRankTier(percentile) {
    if (percentile === null || percentile === undefined) {
        return {
            tier: 'Unranked',
            color: '#6b7280',
            gradient: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
            textColor: '#ffffff',
            minPoints: 0,
            maxPoints: 0
        };
    }
    
    if (percentile < 0.2) {
        return {
            tier: 'Bronze',
            color: '#cd7f32',
            gradient: 'linear-gradient(135deg, #cd7f32 0%, #b8860b 100%)',
            textColor: '#ffffff',
            minPoints: 0,
            maxPoints: 600
        };
    }
    
    if (percentile < 0.4) {
        return {
            tier: 'Silver',
            color: '#c0c0c0',
            gradient: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)',
            textColor: '#000000',
            minPoints: 600,
            maxPoints: 1200
        };
    }
    
    if (percentile < 0.6) {
        return {
            tier: 'Gold',
            color: '#ffd700',
            gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
            textColor: '#000000',
            minPoints: 1200,
            maxPoints: 1800
        };
    }
    
    if (percentile < 0.8) {
        return {
            tier: 'Platinum',
            color: '#00d4ff',
            gradient: 'linear-gradient(135deg, #00d4ff 0%, #00a8cc 100%)',
            textColor: '#000000',
            minPoints: 1800,
            maxPoints: 2400
        };
    }
    
    if (percentile < 0.9) {
        return {
            tier: 'Diamond',
            color: '#4169e1',
            gradient: 'linear-gradient(135deg, #4169e1 0%, #1e90ff 100%)',
            textColor: '#ffffff',
            minPoints: 2400,
            maxPoints: 2700
        };
    }
    
    if (percentile < 0.97) {
        return {
            tier: 'Master',
            color: '#ff1493',
            gradient: 'linear-gradient(135deg, #ff1493 0%, #ff69b4 100%)',
            textColor: '#ffffff',
            minPoints: 2700,
            maxPoints: 2910
        };
    }
    
    if (percentile < 0.99) {
        return {
            tier: 'Grandmaster',
            color: '#9370db',
            gradient: 'linear-gradient(135deg, #9370db 0%, #ba55d3 100%)',
            textColor: '#ffffff',
            minPoints: 2910,
            maxPoints: 2970
        };
    }
    
    return {
        tier: 'Champion',
        color: '#ffd700',
        gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)',
        textColor: '#000000',
        minPoints: 2970,
        maxPoints: 3000
    };
}

/**
 * Check if a task is a ranked task (appears in baselines.json)
 * 
 * @param {string} taskName - Name of the task/scenario
 * @returns {boolean|object} - false if not ranked, task data if ranked
 */
function isRankedTask(taskName) {
    const baselines = loadBaselines();
    const taskData = Object.values(baselines.tasks).find(
        task => task.scenarioName === taskName
    );
    return taskData || false;
}

/**
 * Get all ranked tasks organized by category
 * 
 * @returns {object} - { Flicking: [...], Tracking: [...], 'Target Switching': [...] }
 */
function getRankedTasksByCategory() {
    const baselines = loadBaselines();
    const categorized = {
        'Flicking': [],
        'Tracking': [],
        'Target Switching': []
    };
    
    Object.values(baselines.tasks).forEach(task => {
        if (categorized[task.category]) {
            categorized[task.category].push(task);
        }
    });
    
    return categorized;
}

/**
 * Get all rank tiers for display in rank ladder
 * 
 * @returns {array} - Array of all rank tiers with point ranges
 */
function getAllRankTiers() {
    return [
        {
            tier: 'Bronze',
            color: '#cd7f32',
            gradient: 'linear-gradient(135deg, #cd7f32 0%, #b8860b 100%)',
            textColor: '#ffffff',
            minPoints: 0,
            maxPoints: 600,
            percentileRange: '0-20%'
        },
        {
            tier: 'Silver',
            color: '#c0c0c0',
            gradient: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)',
            textColor: '#000000',
            minPoints: 600,
            maxPoints: 1200,
            percentileRange: '20-40%'
        },
        {
            tier: 'Gold',
            color: '#ffd700',
            gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
            textColor: '#000000',
            minPoints: 1200,
            maxPoints: 1800,
            percentileRange: '40-60%'
        },
        {
            tier: 'Platinum',
            color: '#00d4ff',
            gradient: 'linear-gradient(135deg, #00d4ff 0%, #00a8cc 100%)',
            textColor: '#000000',
            minPoints: 1800,
            maxPoints: 2400,
            percentileRange: '60-80%'
        },
        {
            tier: 'Diamond',
            color: '#4169e1',
            gradient: 'linear-gradient(135deg, #4169e1 0%, #1e90ff 100%)',
            textColor: '#ffffff',
            minPoints: 2400,
            maxPoints: 2700,
            percentileRange: '80-90%'
        },
        {
            tier: 'Master',
            color: '#ff1493',
            gradient: 'linear-gradient(135deg, #ff1493 0%, #ff69b4 100%)',
            textColor: '#ffffff',
            minPoints: 2700,
            maxPoints: 2910,
            percentileRange: '90-97%'
        },
        {
            tier: 'Grandmaster',
            color: '#9370db',
            gradient: 'linear-gradient(135deg, #9370db 0%, #ba55d3 100%)',
            textColor: '#ffffff',
            minPoints: 2910,
            maxPoints: 2970,
            percentileRange: '97-99%'
        },
        {
            tier: 'Champion',
            color: '#ffd700',
            gradient: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)',
            textColor: '#000000',
            minPoints: 2970,
            maxPoints: 3000,
            percentileRange: '99%+'
        }
    ];
}

module.exports = {
    loadBaselines,
    loadTop12,
    scoreToPercentile,
    aggregateCategoryRating,
    computeOverallRating,
    getRankTier,
    percentileToPoints,
    getAllRankTiers,
    isRankedTask,
    getRankedTasksByCategory
};
