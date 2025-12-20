// backend/utils/time.js
// Centralized time/date utility functions

/**
 * Converts a Date object to a local ISO string format (no timezone suffix)
 * Format: YYYY-MM-DDTHH:mm:ss.SSS
 * This ensures consistent timestamp handling across the app
 */
function toLocalISOString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Get ISO timestamp for X days ago
 * Used for date range queries
 */
function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

/**
 * Resolve window definition to absolute timestamps
 * Supports presets like 'today', 'yesterday', 'thisWeek', etc.
 * And relative windows like { type: 'relative', hours: 24 }
 */
function resolveWindow(windowDef) {
    const now = new Date();

    // Preset shortcuts
    if (typeof windowDef === 'string') {
        switch (windowDef) {
            case 'today': {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                return { startTime: start.toISOString(), endTime: end.toISOString() };
            }
            case 'yesterday': {
                const start = new Date(now);
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setHours(23, 59, 59, 999);
                return { startTime: start.toISOString(), endTime: end.toISOString() };
            }
            case 'thisWeek': {
                const start = new Date(now);
                const dayOfWeek = start.getDay();
                start.setDate(start.getDate() - dayOfWeek);
                start.setHours(0, 0, 0, 0);
                return { startTime: start.toISOString(), endTime: now.toISOString() };
            }
            case 'lastWeek': {
                const start = new Date(now);
                const dayOfWeek = start.getDay();
                start.setDate(start.getDate() - dayOfWeek - 7);
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return { startTime: start.toISOString(), endTime: end.toISOString() };
            }
            case 'thisMonth': {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                return { startTime: start.toISOString(), endTime: now.toISOString() };
            }
            case 'lastMonth': {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                return { startTime: start.toISOString(), endTime: end.toISOString() };
            }
        }
    }

    // Relative time window (hours back)
    if (windowDef.type === 'relative') {
        const { hours, hoursAgo = 0 } = windowDef;
        const end = new Date(now);
        end.setHours(end.getHours() - hoursAgo);
        const start = new Date(end);
        start.setHours(start.getHours() - hours);
        return { startTime: start.toISOString(), endTime: end.toISOString() };
    }

    // Absolute timestamps
    if (windowDef.startTime && windowDef.endTime) {
        return {
            startTime: windowDef.startTime,
            endTime: windowDef.endTime
        };
    }

    throw new Error('Invalid window definition');
}

module.exports = {
    toLocalISOString,
    daysAgoIso,
    resolveWindow
};
