// backend/routes/comparisons.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
    const { aggregateRuns, compareAggregations, resolveWindow } = require('../core/aggregation/aggregator');

    function getWindowLabel(windowDef) {
        if (typeof windowDef === 'string') {
            const labels = {
                'today': 'Today',
                'yesterday': 'Yesterday',
                'thisWeek': 'This Week',
                'lastWeek': 'Last Week',
                'thisMonth': 'This Month',
                'lastMonth': 'Last Month'
            };
            return labels[windowDef] || windowDef;
        }
        
        if (windowDef.type === 'relative') {
            const { hours, hoursAgo = 0 } = windowDef;
            if (hoursAgo > 0) {
                return `${hoursAgo + hours}h to ${hoursAgo}h ago`;
            }
            return `Last ${hours}h`;
        }
        
        if (windowDef.type === 'timeframe') {
            return 'Custom Range';
        }
        
        return 'Unknown';
    }

    // Run a comparison between two time windows
    router.post('/run', async (req, res) => {
        try {
            const { left, right, taskScope } = req.body;

            if (!left || !right) {
                return res.status(400).json({ error: 'Left and right windows are required' });
            }

            // Handle session-based windows
            let leftDef = left;
            let rightDef = right;
            let leftSession = null;
            let rightSession = null;

            if (left.type === 'session' && left.sessionId) {
                leftSession = await db.get('SELECT * FROM sessions WHERE id = ?', [left.sessionId]);
                if (!leftSession) {
                    return res.status(404).json({ error: `Session ${left.sessionId} not found` });
                }
                leftDef = {
                    startTime: leftSession.started_at,
                    endTime: leftSession.ended_at || new Date().toISOString()
                };
            }

            if (right.type === 'session' && right.sessionId) {
                rightSession = await db.get('SELECT * FROM sessions WHERE id = ?', [right.sessionId]);
                if (!rightSession) {
                    return res.status(404).json({ error: `Session ${right.sessionId} not found` });
                }
                rightDef = {
                    startTime: rightSession.started_at,
                    endTime: rightSession.ended_at || new Date().toISOString()
                };
            }

            const leftWindow = resolveWindow(leftDef);
            const rightWindow = resolveWindow(rightDef);

            // Generate labels - use session name if available
            const leftLabel = leftSession 
                ? (leftSession.name || `Session ${left.sessionId}`) 
                : getWindowLabel(left);
            const rightLabel = rightSession 
                ? (rightSession.name || `Session ${right.sessionId}`) 
                : getWindowLabel(right);

            let taskIds;
            if (taskScope === 'common') {
                const leftTasks = await db.all(`
                    SELECT DISTINCT task_id FROM runs
                    WHERE played_at >= ? AND played_at <= ? AND is_practice = 0
                `, [leftWindow.startTime, leftWindow.endTime]);

                const rightTasks = await db.all(`
                    SELECT DISTINCT task_id FROM runs
                    WHERE played_at >= ? AND played_at <= ? AND is_practice = 0
                `, [rightWindow.startTime, rightWindow.endTime]);

                const leftTaskIds = new Set(leftTasks.map(r => r.task_id));
                const rightTaskIds = new Set(rightTasks.map(r => r.task_id));
                taskIds = [...leftTaskIds].filter(id => rightTaskIds.has(id));

                leftWindow.taskIds = taskIds;
                rightWindow.taskIds = taskIds;
            }

            const leftData = await aggregateRuns(db, leftWindow);
            const rightData = await aggregateRuns(db, rightWindow);

            if (taskScope === 'common' && (!leftData || !rightData || leftData.totalRuns === 0 || rightData.totalRuns === 0)) {
                const leftTasksAll = await db.all(`
                    SELECT DISTINCT task_id FROM runs
                    WHERE played_at >= ? AND played_at <= ? AND is_practice = 0
                `, [leftWindow.startTime, leftWindow.endTime]);

                const rightTasksAll = await db.all(`
                    SELECT DISTINCT task_id FROM runs
                    WHERE played_at >= ? AND played_at <= ? AND is_practice = 0
                `, [rightWindow.startTime, rightWindow.endTime]);

                const leftTaskIds = new Set(leftTasksAll.map(r => r.task_id));
                const rightTaskIds = new Set(rightTasksAll.map(r => r.task_id));
                const sharedIds = [...leftTaskIds].filter(id => rightTaskIds.has(id));
                taskIds = sharedIds;

                if (sharedIds.length > 0) {
                    const leftShared = await aggregateRuns(db, { ...leftWindow, taskIds: sharedIds });
                    const rightShared = await aggregateRuns(db, { ...rightWindow, taskIds: sharedIds });
                    const comparison = compareAggregations(leftShared, rightShared);
                    comparison.labels = { left: leftLabel, right: rightLabel };
                    
                    // Add session IDs to meta if this is a session comparison
                    if (leftSession) {
                        comparison.meta.leftSessionId = left.sessionId;
                    }
                    if (rightSession) {
                        comparison.meta.rightSessionId = right.sessionId;
                    }
                    
                    return res.json(comparison);
                }
            }

            const comparison = compareAggregations(leftData, rightData);
            comparison.labels = { left: leftLabel, right: rightLabel };
            
            // Add session IDs to meta if this is a session comparison
            if (leftSession) {
                comparison.meta.leftSessionId = left.sessionId;
            }
            if (rightSession) {
                comparison.meta.rightSessionId = right.sessionId;
            }
            
            res.json(comparison);
        } catch (e) {
            console.error('Error running comparison:', e);
            res.status(500).json({ error: 'Failed to run comparison: ' + e.message });
        }
    });

    // Save a comparison preset
    router.post('/save', async (req, res) => {
        try {
            const { name, description, left, right, taskScope } = req.body;

            if (!name || !left || !right) {
                return res.status(400).json({ error: 'Name, left, and right are required' });
            }

            const result = await db.run(`
                INSERT INTO comparisons (name, description, left_type, left_value, right_type, right_value, task_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                name,
                description || null,
                left.type || 'timeframe',
                JSON.stringify(left),
                right.type || 'timeframe',
                JSON.stringify(right),
                taskScope || 'all'
            ]);

            const comparison = await db.get('SELECT * FROM comparisons WHERE id = ?', [result.lastID]);
            res.json(comparison);
        } catch (e) {
            console.error('Error saving comparison:', e);
            res.status(500).json({ error: 'Failed to save comparison' });
        }
    });

    // Get all saved comparisons
    router.get('/', async (_req, res) => {
        try {
            const comparisons = await db.all('SELECT * FROM comparisons ORDER BY created_at DESC');
            res.json(comparisons);
        } catch (e) {
            console.error('Error fetching comparisons:', e);
            res.status(500).json({ error: 'Failed to fetch comparisons' });
        }
    });

    // Get and re-run a saved comparison
    router.get('/:id/run', async (req, res) => {
        try {
            const { id } = req.params;
            const comparison = await db.get('SELECT * FROM comparisons WHERE id = ?', [id]);

            if (!comparison) {
                return res.status(404).json({ error: 'Comparison not found' });
            }

            await db.run('UPDATE comparisons SET last_used_at = ? WHERE id = ?', [
                new Date().toISOString(),
                id
            ]);

            const left = JSON.parse(comparison.left_value);
            const right = JSON.parse(comparison.right_value);

            const leftWindow = resolveWindow(left);
            const rightWindow = resolveWindow(right);

            const leftData = await aggregateRuns(db, leftWindow);
            const rightData = await aggregateRuns(db, rightWindow);

            const result = compareAggregations(leftData, rightData);
            res.json(result);
        } catch (e) {
            console.error('Error re-running comparison:', e);
            res.status(500).json({ error: 'Failed to re-run comparison: ' + e.message });
        }
    });

    // Delete a comparison
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await db.run('DELETE FROM comparisons WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (e) {
            console.error('Error deleting comparison:', e);
            res.status(500).json({ error: 'Failed to delete comparison' });
        }
    });

    // Aggregate data for a time window (generic utility)
    router.post('/aggregate', async (req, res) => {
        try {
            const { startTime, endTime, taskIds } = req.body;

            if (!startTime || !endTime) {
                return res.status(400).json({ error: 'startTime and endTime are required' });
            }

            const data = await aggregateRuns(db, { startTime, endTime, taskIds });
            res.json(data);
        } catch (e) {
            console.error('Error aggregating data:', e);
            res.status(500).json({ error: 'Failed to aggregate data: ' + e.message });
        }
    });

    // Get top runs for a task within a time window
    router.get('/tasks/:taskId/top-runs', async (req, res) => {
        try {
            const { taskId } = req.params;
            const { startTime, endTime, limit = 3, sortBy = 'score' } = req.query;

            if (!startTime || !endTime) {
                return res.status(400).json({ error: 'startTime and endTime are required' });
            }

            const runs = await getTopRunsForTask(db, {
                startTime,
                endTime,
                taskId: parseInt(taskId),
                limit: parseInt(limit),
                sortBy
            });

            res.json(runs);
        } catch (e) {
            console.error('Error fetching top runs:', e);
            res.status(500).json({ error: 'Failed to fetch top runs' });
        }
    });

    return router;
};
