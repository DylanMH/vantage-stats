// backend/utils/rankedProgress.js
/**
 * Ranked Progress System Utilities
 * 
 * Purpose: Progress/XP system that works in tandem with the truthful skill ranking.
 * Rewards improvement and grinding while anchored to actual skill tier.
 * 
 * Key Functions:
 * - computeSkillTargetPoints: Convert skill percentile to target points for anchoring
 * - computeRunXpGain: Calculate XP gain from a single run based on improvement
 * - updateCategoryProgress: Update progress after a new run, with anchoring logic
 * - getCategoryProgress: Fetch current progress state from DB
 * 
 * Communicates With:
 * - ranked utilities (tier info, percentiles)
 * - Database (ranked_category_progress table)
 * - Ranked routes API (provides progress data alongside skill data)
 */

const { percentileToPoints, getRankTier } = require('./ranked');

/**
 * Convert skill percentile to target points for progress anchoring
 * 
 * @param {number|null} skillPercentile - Current skill percentile (0-1)
 * @returns {number} - Target points (0-3000)
 */
function computeSkillTargetPoints(skillPercentile) {
    if (skillPercentile === null || skillPercentile === undefined) {
        return 0;
    }
    return Math.round(skillPercentile * 3000);
}

/**
 * Compute XP gain from a single run
 * 
 * @param {object} params
 * @param {number} params.pNow - Percentile of latest run (0-1)
 * @param {number} params.pBase - Baseline percentile from previous runs (0-1)
 * @param {string} params.skillTier - Current skill tier name
 * @returns {number} - XP gain (minimum 1)
 * 
 * Algorithm:
 * 1. Base XP: 4 points for any run
 * 2. Improvement bonus: (pNow - pBase) * 100, clamped to [-5, +20]
 * 3. Tier multiplier: Higher tiers gain XP slower
 * 4. Result: max(1, round((baseXP + improveXP) * tierMultiplier))
 */
function computeRunXpGain({ pNow, pBase, skillTier }) {
    const baseXP = 4;
    
    const deltaPct = (pNow - pBase) * 100;
    const improveXP = Math.max(-5, Math.min(20, deltaPct));
    
    const tierMultipliers = {
        'Bronze': 1.00,
        'Silver': 0.95,
        'Gold': 0.90,
        'Platinum': 0.85,
        'Diamond': 0.80,
        'Master': 0.70,
        'Grandmaster': 0.60,
        'Champion': 0.50,
        'Unranked': 1.00
    };
    
    const tierMultiplier = tierMultipliers[skillTier] || 1.00;
    const xpGain = Math.max(1, Math.round((baseXP + improveXP) * tierMultiplier));
    
    return xpGain;
}

/**
 * Get current progress state for a category
 * 
 * @param {object} db - Database connection
 * @param {string} category - Category name
 * @returns {object|null} - Progress data or null if not found
 */
async function getCategoryProgress(db, category) {
    const row = await db.get(
        'SELECT * FROM ranked_category_progress WHERE category = ?',
        [category]
    );
    return row || null;
}

/**
 * Initialize progress for a category if it doesn't exist
 * 
 * @param {object} db - Database connection
 * @param {string} category - Category name
 */
async function initializeCategoryProgress(db, category) {
    await db.run(`
        INSERT OR IGNORE INTO ranked_category_progress 
        (category, xp, progress_points, last_updated_at, last_run_at, runs_count, distinct_tasks_count)
        VALUES (?, 0, 0, datetime('now'), NULL, 0, 0)
    `, [category]);
}

/**
 * Update category progress after a new run
 * 
 * @param {object} params
 * @param {object} params.db - Database connection
 * @param {string} params.category - Category name
 * @param {string} params.skillTier - Current skill tier name
 * @param {number} params.skillPercentile - Current skill percentile (0-1)
 * @param {number[]} params.recentPercentiles - Recent percentiles (newest first)
 * @param {number} params.lastRunPercentile - Newest run percentile
 * @param {number} params.distinctTasks - Number of distinct tasks played
 * @returns {object} - Updated progress data with xpGain
 */
async function updateCategoryProgress({
    db,
    category,
    skillTier,
    skillPercentile,
    recentPercentiles,
    lastRunPercentile,
    distinctTasks
}) {
    await initializeCategoryProgress(db, category);
    
    const current = await getCategoryProgress(db, category);
    
    let currentXp = current?.xp || 0;
    let currentProgressPoints = current?.progress_points || 0;
    let currentRunsCount = current?.runs_count || 0;
    
    const pNow = lastRunPercentile;
    
    const previousPercentiles = recentPercentiles.slice(1, 11);
    const pBase = previousPercentiles.length > 0
        ? previousPercentiles.reduce((sum, p) => sum + p, 0) / previousPercentiles.length
        : lastRunPercentile;
    
    const xpGain = computeRunXpGain({
        pNow,
        pBase,
        skillTier
    });
    
    const newXp = Math.max(0, Math.min(1200, currentXp + xpGain));
    
    const skillTargetPoints = computeSkillTargetPoints(skillPercentile);
    
    const tierData = getRankTier(skillPercentile);
    const tierMin = tierData.minPoints;
    const tierMax = tierData.maxPoints;
    const overflowPoints = 60;
    
    const rubberband = (skillTargetPoints - currentProgressPoints) * 0.05;
    const additiveGain = xpGain * 2;
    let newProgressPoints = currentProgressPoints + rubberband + additiveGain;
    newProgressPoints = Math.max(tierMin, Math.min(tierMax + overflowPoints, newProgressPoints));
    
    const newRunsCount = currentRunsCount + 1;
    
    await db.run(`
        UPDATE ranked_category_progress
        SET xp = ?,
            progress_points = ?,
            last_updated_at = datetime('now'),
            last_run_at = datetime('now'),
            runs_count = ?,
            distinct_tasks_count = ?
        WHERE category = ?
    `, [newXp, Math.round(newProgressPoints), newRunsCount, distinctTasks, category]);
    
    return {
        xp: newXp,
        xpMax: 1000,
        overflowMax: 1200,
        xpGainLastRun: xpGain,
        progressPoints: Math.round(newProgressPoints),
        progressTierDisplay: skillTier,
        isOverflow: newXp > 1000
    };
}

/**
 * Get progress display data for a category
 * 
 * @param {object} db - Database connection
 * @param {string} category - Category name
 * @param {string} skillTier - Current skill tier name
 * @returns {object} - Progress display data
 */
async function getProgressDisplayData(db, category, skillTier) {
    const progress = await getCategoryProgress(db, category);
    
    if (!progress) {
        return {
            xp: 0,
            xpMax: 1000,
            overflowMax: 1200,
            xpGainLastRun: 0,
            progressPoints: 0,
            progressTierDisplay: skillTier,
            isOverflow: false
        };
    }
    
    return {
        xp: progress.xp,
        xpMax: 1000,
        overflowMax: 1200,
        xpGainLastRun: 0,
        progressPoints: progress.progress_points,
        progressTierDisplay: skillTier,
        isOverflow: progress.xp > 1000
    };
}

module.exports = {
    computeSkillTargetPoints,
    computeRunXpGain,
    getCategoryProgress,
    initializeCategoryProgress,
    updateCategoryProgress,
    getProgressDisplayData
};
