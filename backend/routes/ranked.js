// backend/routes/ranked.js
/**
 * Ranked System Routes
 * 
 * Purpose: API endpoints for the ranked competitive system.
 * Provides user's ranked stats, category ratings, and overall rank.
 * 
 * Endpoints:
 * - GET /api/ranked/stats - Get user's complete ranked stats (all categories + overall)
 * - GET /api/ranked/category/:category - Get detailed stats for a specific category
 * - GET /api/ranked/tasks - Get all ranked tasks organized by category
 * - GET /api/ranked/leaderboard/:leaderboardId/percentile - Calculate percentile for a score
 * 
 * Communicates With:
 * - ranked utilities (calculation engine)
 * - Database (user's runs)
 * - Frontend Ranked page (provides data for display)
 */

const express = require('express');
const router = express.Router();
const { 
    aggregateCategoryRating, 
    computeOverallRating, 
    getRankTier,
    scoreToPercentile,
    percentileToPoints,
    getAllRankTiers,
    getRankedTasksByCategory,
    loadBaselines,
    loadTop12
} = require('../utils/ranked');
const {
    getProgressDisplayData,
    computeRunXpGain
} = require('../utils/rankedProgress');

module.exports = (db) => {
    /**
     * GET /api/ranked/stats
     * 
     * Get user's complete ranked stats
     * Returns overall rank + all category ratings with tier information
     */
    router.get('/stats', async (req, res) => {
        try {
            const categories = ['Flicking', 'Tracking', 'Target Switching'];
            const categoryRatings = {};
            
            // Aggregate rating for each category
            for (const category of categories) {
                const rating = await aggregateCategoryRating(db, category, 30);
                categoryRatings[category] = rating;
            }
            
            // Compute overall rating
            const overallResult = computeOverallRating(categoryRatings);
            
            // Build response with tier info and points
            const response = {
                overall: {
                    rating: overallResult.overall,
                    percentile: overallResult.overall,
                    points: percentileToPoints(overallResult.overall),
                    isProvisional: overallResult.isProvisional,
                    tier: getRankTier(overallResult.overall)
                },
                categories: {}
            };
            
            // Add tier info, points, and progress for each category
            for (const category of categories) {
                const catData = categoryRatings[category];
                const tierInfo = getRankTier(catData.rating);
                const progressData = await getProgressDisplayData(db, category, tierInfo.tier);
                
                response.categories[category] = {
                    rating: catData.rating,
                    percentile: catData.rating,
                    points: percentileToPoints(catData.rating),
                    distinctTasks: catData.distinctTasks,
                    totalRuns: catData.totalRuns,
                    isProvisional: catData.isProvisional,
                    tier: tierInfo,
                    progress: progressData
                };
            }
            
            res.json(response);
        } catch (e) {
            console.error('Error fetching ranked stats:', e);
            res.status(500).json({ error: 'Failed to fetch ranked stats' });
        }
    });
    
    /**
     * GET /api/ranked/category/:category
     * 
     * Get detailed stats for a specific category
     * Includes recent runs, top contributing tasks, etc.
     */
    router.get('/category/:category', async (req, res) => {
        try {
            const { category } = req.params;
            const validCategories = ['Flicking', 'Tracking', 'Target Switching'];
            
            if (!validCategories.includes(category)) {
                return res.status(400).json({ error: 'Invalid category' });
            }
            
            // Get category rating
            const rating = await aggregateCategoryRating(db, category, 30);
            
            // Get baselines for task info
            const baselines = loadBaselines();
            const categoryTasks = Object.values(baselines.tasks)
                .filter(task => task.category === category);
            
            const taskNames = categoryTasks.map(task => task.scenarioName);
            const namePlaceholders = taskNames.map(() => '?').join(',');
            
            // Get user's runs for this category's tasks
            const runs = await db.all(`
                SELECT 
                    r.id,
                    r.score,
                    r.played_at,
                    t.name as task_name
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                WHERE t.name IN (${namePlaceholders})
                  AND r.is_practice = 0
                  AND r.score IS NOT NULL
                ORDER BY r.played_at DESC
                LIMIT 50
            `, taskNames);
            
            // Calculate percentile for each run
            const runsWithPercentile = runs.map(run => {
                const taskData = categoryTasks.find(t => t.scenarioName === run.task_name);
                if (taskData) {
                    const percentile = scoreToPercentile(taskData.leaderboardId, run.score);
                    return {
                        ...run,
                        percentile,
                        tier: getRankTier(percentile)
                    };
                }
                return run;
            });
            
            // Find top contributing tasks (tasks with highest average percentile)
            const taskPerformance = {};
            runsWithPercentile.forEach(run => {
                if (run.percentile !== null) {
                    if (!taskPerformance[run.task_name]) {
                        taskPerformance[run.task_name] = {
                            task: run.task_name,
                            percentiles: [],
                            count: 0
                        };
                    }
                    taskPerformance[run.task_name].percentiles.push(run.percentile);
                    taskPerformance[run.task_name].count++;
                }
            });
            
            const topTasks = Object.values(taskPerformance)
                .map(tp => {
                    const avg = tp.percentiles.reduce((sum, p) => sum + p, 0) / tp.percentiles.length;
                    return {
                        task: tp.task,
                        avgPercentile: avg,
                        count: tp.count,
                        tier: getRankTier(avg)
                    };
                })
                .sort((a, b) => b.avgPercentile - a.avgPercentile)
                .slice(0, 5);
            
            const tierInfo = getRankTier(rating.rating);
            const progressData = await getProgressDisplayData(db, category, tierInfo.tier);
            
            res.json({
                category,
                rating: rating.rating,
                percentile: rating.rating,
                distinctTasks: rating.distinctTasks,
                totalRuns: rating.totalRuns,
                isProvisional: rating.isProvisional,
                tier: tierInfo,
                progress: progressData,
                topTasks,
                recentRuns: runsWithPercentile.slice(0, 10)
            });
        } catch (e) {
            console.error('Error fetching category stats:', e);
            res.status(500).json({ error: 'Failed to fetch category stats' });
        }
    });
    
    /**
     * GET /api/ranked/tasks
     * 
     * Get all ranked tasks organized by category
     * Includes task metadata and user's stats if available
     */
    router.get('/tasks', async (req, res) => {
        try {
            const categorized = getRankedTasksByCategory();
            const top12 = loadTop12();
            
            // For each category, get user's stats for each task
            const response = {};
            
            for (const [category, tasks] of Object.entries(categorized)) {
                response[category] = {
                    tasks: tasks.map(task => ({
                        leaderboardId: task.leaderboardId,
                        scenarioName: task.scenarioName,
                        category: task.category,
                        entries: task.entries,
                        plays: task.plays,
                        cutoffs: task.cutoffs
                    })),
                    top12: top12[category] || []
                };
            }
            
            // Get user's play counts for ranked tasks
            const taskNames = Object.values(categorized)
                .flat()
                .map(t => t.scenarioName);
            
            if (taskNames.length > 0) {
                const namePlaceholders = taskNames.map(() => '?').join(',');
                const userStats = await db.all(`
                    SELECT 
                        t.name,
                        COUNT(*) as user_plays,
                        MAX(r.score) as best_score,
                        MAX(r.played_at) as last_played
                    FROM runs r
                    JOIN tasks t ON r.task_id = t.id
                    WHERE t.name IN (${namePlaceholders})
                      AND r.is_practice = 0
                    GROUP BY t.name
                `, taskNames);
                
                // Merge user stats into response
                for (const [category, data] of Object.entries(response)) {
                    data.tasks = data.tasks.map(task => {
                        const userStat = userStats.find(s => s.name === task.scenarioName);
                        if (userStat) {
                            const percentile = scoreToPercentile(task.leaderboardId, userStat.best_score);
                            return {
                                ...task,
                                userPlays: userStat.user_plays,
                                bestScore: userStat.best_score,
                                bestPercentile: percentile,
                                bestTier: getRankTier(percentile),
                                lastPlayed: userStat.last_played
                            };
                        }
                        return {
                            ...task,
                            userPlays: 0,
                            bestScore: null,
                            bestPercentile: null,
                            bestTier: null,
                            lastPlayed: null
                        };
                    });
                }
            }
            
            res.json(response);
        } catch (e) {
            console.error('Error fetching ranked tasks:', e);
            res.status(500).json({ error: 'Failed to fetch ranked tasks' });
        }
    });
    
    /**
     * GET /api/ranked/recent-runs/:category
     * 
     * Get the 5 most recent ranked runs for a category with percentile calculations
     * Shows how each run contributed to the user's rank
     */
    router.get('/recent-runs/:category', async (req, res) => {
        try {
            const { category } = req.params;
            const baselines = loadBaselines();
            
            // Validate category
            if (!['Flicking', 'Tracking', 'Target Switching'].includes(category)) {
                return res.status(400).json({ error: 'Invalid category' });
            }
            
            // Get all task names for this category
            const taskNames = Object.values(baselines.tasks)
                .filter(task => task.category === category)
                .map(task => task.scenarioName);
            
            if (taskNames.length === 0) {
                return res.json({ recentRuns: [] });
            }
            
            // Get more runs to calculate XP deltas (need context)
            const namePlaceholders = taskNames.map(() => '?').join(',');
            const allRecentRuns = await db.all(`
                SELECT 
                    r.id,
                    r.score,
                    r.played_at,
                    t.name as task_name
                FROM runs r
                JOIN tasks t ON r.task_id = t.id
                WHERE t.name IN (${namePlaceholders})
                  AND r.is_practice = 0
                ORDER BY r.played_at DESC
                LIMIT 30
            `, taskNames);
            
            // Get category rating for tier info
            const categoryRating = await aggregateCategoryRating(db, category, 30);
            const tierInfo = getRankTier(categoryRating.rating);
            
            // Calculate percentile and XP for each run
            const runsWithPercentiles = allRecentRuns.slice(0, 5).map((run, index) => {
                // Find the leaderboard ID for this task
                const taskData = Object.values(baselines.tasks)
                    .find(t => t.scenarioName === run.task_name);
                
                if (!taskData) {
                    return {
                        ...run,
                        percentile: null,
                        tier: null,
                        leaderboardId: null
                    };
                }
                
                const percentile = scoreToPercentile(taskData.leaderboardId, run.score);
                const tier = getRankTier(percentile);
                const points = percentileToPoints(percentile);
                
                // Calculate XP gain for this run
                let xpGain = 0;
                if (categoryRating.rating !== null && !categoryRating.isProvisional) {
                    // Get previous runs to calculate baseline
                    const previousRuns = allRecentRuns.slice(index + 1, index + 11);
                    const previousPercentiles = previousRuns
                        .map(prevRun => {
                            const prevTaskData = Object.values(baselines.tasks)
                                .find(t => t.scenarioName === prevRun.task_name);
                            if (prevTaskData) {
                                return scoreToPercentile(prevTaskData.leaderboardId, prevRun.score);
                            }
                            return null;
                        })
                        .filter(p => p !== null);
                    
                    const pBase = previousPercentiles.length > 0
                        ? previousPercentiles.reduce((sum, p) => sum + p, 0) / previousPercentiles.length
                        : percentile;
                    
                    xpGain = computeRunXpGain({
                        pNow: percentile,
                        pBase,
                        skillTier: tierInfo.tier
                    });
                }
                
                return {
                    id: run.id,
                    taskName: run.task_name,
                    score: run.score,
                    playedAt: run.played_at,
                    percentile,
                    points,
                    tier,
                    leaderboardId: taskData.leaderboardId,
                    xpGain
                };
            });
            
            res.json({ recentRuns: runsWithPercentiles });
        } catch (e) {
            console.error('Error fetching recent runs:', e);
            res.status(500).json({ error: 'Failed to fetch recent runs' });
        }
    });
    
    /**
     * POST /api/ranked/calculate-percentile
     * 
     * Calculate percentile for a given score and leaderboard ID
     * Body: { leaderboardId, score }
     */
    router.post('/calculate-percentile', async (req, res) => {
        try {
            const { leaderboardId, score } = req.body;
            
            if (!leaderboardId || score === undefined || score === null) {
                return res.status(400).json({ error: 'leaderboardId and score are required' });
            }
            
            const percentile = scoreToPercentile(leaderboardId, score);
            const tier = getRankTier(percentile);
            const points = percentileToPoints(percentile);
            
            res.json({
                leaderboardId,
                score,
                percentile,
                points,
                tier
            });
        } catch (e) {
            console.error('Error calculating percentile:', e);
            res.status(500).json({ error: 'Failed to calculate percentile' });
        }
    });
    
    /**
     * GET /api/ranked/tiers
     * 
     * Get all rank tiers for display in rank ladder
     */
    router.get('/tiers', async (req, res) => {
        try {
            const tiers = getAllRankTiers();
            res.json({ tiers });
        } catch (e) {
            console.error('Error fetching rank tiers:', e);
            res.status(500).json({ error: 'Failed to fetch rank tiers' });
        }
    });

    return router;
};
