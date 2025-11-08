// backend/csvParser.js
const fs = require('fs');
const path = require('path');

const KEYMAP = {
    scenario: ['scenario', 'scenario name', 'task', 'map', 'name'],
    score: ['score', 'final score', 'points'],
    hits: ['hits', 'kills', 'targets destroyed', 'eliminations', 'targets hit', 'hit count', 'hit count:'],
    misses: ['misses', 'shots missed', 'miss count', 'miss count:'],
    shots: ['shots', 'shots fired', 'total shots', 'bullets'],
    accuracy: ['accuracy', 'hit %', 'hit percent', 'hit percentage', 'precision', 'hitrate', 'hit rate'],
    avg_ttk: ['avg ttk', 'average ttk', 'average time to kill', 'time to kill avg', 'avg ttk:'],
    overshots: ['overshots', 'overflicks', 'extra shots after kill', 'total overshots', 'total overshots:'],
    reloads: ['reloads', 'num reloads', 'reloads:'],
    fps_avg: ['fps avg', 'average fps', 'avg fps', 'avg fps:'],
    dpi: ['dpi', 'dpi:'],
    sens_h: ['sensitivity', 'sensitivity h', 'sens', 'horiz sens', 'horiz sens:'],
    fov: ['fov', 'field of view', 'fov:'],
    duration: ['duration', 'time played', 'session length', 'time (s)', 'time seconds', 'fight time', 'fight time:'],
    date: ['date', 'played at', 'time', 'timestamp', 'challenge start', 'challenge start:'],
};

function norm(s) { return String(s ?? '').trim().toLowerCase(); }

function parseFloatLocale(v) {
    if (v == null) return null;
    const s = String(v).replace(/[% ]/g, '').replace(/,/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function parseIntSafe(v) {
    if (v == null) return null;
    const s = String(v).replace(/,/g, '').trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}

function parsePercentFlexible(v) {
    if (v == null) return null;
    const raw = String(v).trim();
    if (/^\s*[-+]?\d+(\.\d+)?\s*%\s*$/.test(raw)) {
        const n = parseFloatLocale(raw);
        return Math.max(0, Math.min(100, n));
    }
    const n = parseFloatLocale(raw);
    if (!Number.isFinite(n)) return null;
    if (n <= 1) return Math.max(0, Math.min(100, n * 100)); // ratio → %
    if (n > 100 && n < 1000) {
        // This might be a percentage that was incorrectly parsed (like 700%)
        // Check if it could be a decimal that was multiplied by 100
        if (n / 100 <= 1) {
            return n / 100; // Convert back to proper percentage
        }
    }
    return Math.max(0, Math.min(100, n)); // already percent
}

function parseDurationFlexible(v) {
    if (v == null) return null;
    const s = String(v).trim();
    
    // Handle Fight Time format (minutes with decimals)
    const fightTimeMatch = s.match(/^(\d+(?:\.\d+)?)$/);
    if (fightTimeMatch && s.length < 10) { // Likely fight time in minutes
        const minutes = parseFloat(fightTimeMatch[1]);
        if (minutes < 10) { // Fight time is usually small (under 10 minutes)
            return minutes * 60; // Convert to seconds
        }
    }
    
    // mm:ss or m:ss
    const m = s.match(/^(\d{1,2}):([0-5]\d)(?:\.\d+)?$/);
    if (m) {
        const mins = parseInt(m[1], 10), secs = parseInt(m[2], 10);
        return mins * 60 + secs;
    }
    const n = parseFloatLocale(s);
    return Number.isFinite(n) ? n : null; // assume seconds
}

function parseDateSafe(rawStr, filename) {
    if (rawStr) {
        // Try parsing as-is first
        const d = new Date(rawStr);
        if (!isNaN(d.getTime())) return d.toISOString();
        
        // Try parsing time format (HH:MM:SS.ms) and combine with file date
        const timeMatch = rawStr.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
        if (timeMatch) {
            const base = path.basename(filename);
            const dateMatch = base.match(/(\d{4})\.(\d{2})\.(\d{2})/);
            if (dateMatch) {
                const [_, Y, M, D] = dateMatch;
                const [__, h, m, s, ms] = timeMatch;
                const iso = `${Y}-${M}-${D}T${h}:${m}:${s}.${ms || '000'}Z`;
                const dateObj = new Date(iso);
                if (!isNaN(dateObj.getTime())) return dateObj.toISOString();
            }
        }
    }
    
    // Fallback to filename date extraction
    const base = path.basename(filename);
    const m = base.match(/(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
    if (m) {
        const [_, Y, M, D, h, mi, se] = m;
        const iso = `${Y}-${M}-${D}T${h}:${mi}:${se}Z`;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

function mapRow(row, filename) {
    const m = {};
    const entries = Object.entries(row);
    
    // First pass: exact matches only
    for (const [ourKey, aliases] of Object.entries(KEYMAP)) {
        for (const [h, v] of entries) {
            const hn = norm(h);
            if (aliases.some(a => hn === a)) { 
                m[ourKey] = v; 
                break; 
            }
        }
    }
    
    // Second pass: partial matches for keys we haven't found yet
    for (const [ourKey, aliases] of Object.entries(KEYMAP)) {
        if (m[ourKey]) continue; // Skip if already found exact match
        for (const [h, v] of entries) {
            const hn = norm(h);
            if (aliases.some(a => hn.includes(a))) { 
                m[ourKey] = v; 
                break; 
            }
        }
    }

    // Normalize
    const hits = parseIntSafe(m.hits);
    const shots = parseIntSafe(m.shots);
    let accuracy = parsePercentFlexible(m.accuracy);
    
    // Calculate accuracy from hits/shots if not available or if it's clearly wrong
    if ((accuracy == null || Number.isNaN(accuracy) || accuracy > 100) && hits != null && shots && shots > 0) {
        accuracy = (hits / shots) * 100;
        // Cap at 100%
        accuracy = Math.min(100, Math.max(0, accuracy));
    }

    const duration = parseDurationFlexible(m.duration);
    const score = parseFloatLocale(m.score);
    const score_per_min = (score != null && duration && duration > 0) ? score / (duration / 60) : null;

    // Extract scenario from filename if not found in data
    let scenario = (m.scenario ?? '').toString().trim() || null;
    if (!scenario) {
        const base = path.basename(filename);
        // Extract scenario name from filename (remove date and stats suffix)
        scenario = base.replace(/ - Challenge - \d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2} Stats\.csv$/, '');
        scenario = scenario.replace(/ Stats\.csv$/, '');
    }

    return {
        scenario,
        score,
        hits,
        misses: parseIntSafe(m.misses),
        shots,
        accuracy,
        avg_ttk: parseFloatLocale(m.avg_ttk),
        overshots: parseIntSafe(m.overshots),
        reloads: parseIntSafe(m.reloads),
        fps_avg: parseFloatLocale(m.fps_avg),
        dpi: parseFloatLocale(m.dpi),
        sens_h: parseFloatLocale(m.sens_h),
        fov: parseFloatLocale(m.fov),
        duration,
        score_per_min,
        played_at: parseDateSafe(m.date, filename),
    };
}

// tolerant CSV reader
function parseCsvToRun(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) return mapRow({}, filePath);

    const splitCSV = (line) => {
        const cells = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (c === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
            cur += c;
        }
        cells.push(cur);
        return cells.map(s => s.trim());
    };

    // Parse the entire file to extract summary statistics
    const summaryData = {};
    const killData = [];
    
    // Extract key-value pairs from the summary section AND kill-by-kill data
    for (const line of lines) {
        // Handle "Key:,Value" format (with comma after key) - this is the main format
        const keyValueMatch = line.match(/^([^,]+),\s*(.+)$/);
        if (keyValueMatch) {
            const key = keyValueMatch[1].trim();
            const value = keyValueMatch[2].trim();
            summaryData[key] = value;
            continue; // Skip the colon match if we found this
        }
        
        // Handle "Key: Value" format (without comma after key) - fallback
        const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
        if (colonMatch) {
            const key = colonMatch[1].trim();
            const value = colonMatch[2].trim();
            summaryData[key] = value;
        }
    }

    // Parse kill-by-kill data to calculate aggregated stats
    const header = splitCSV(lines[0]);
    const killNumIdx = header.findIndex(h => norm(h).includes('kill'));
    const timestampIdx = header.findIndex(h => norm(h).includes('timestamp'));
    const ttkIdx = header.findIndex(h => norm(h).includes('ttk'));
    const shotsIdx = header.findIndex(h => norm(h).includes('shot'));
    const hitsIdx = header.findIndex(h => norm(h).includes('hit'));
    const accuracyIdx = header.findIndex(h => norm(h).includes('accuracy'));
    const overshotsIdx = header.findIndex(h => norm(h).includes('overshot'));

    console.log('Header Indices:', { killNumIdx, timestampIdx, ttkIdx, shotsIdx, hitsIdx, overshotsIdx });
    console.log('Header:', header);

    let totalShots = 0;
    let totalHits = 0;
    let totalTTK = 0;
    let ttkCount = 0;
    let totalOvershots = 0;
    let killCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const cells = splitCSV(lines[i]);
        // Check if this is a kill data row (has kill number)
        if (cells[killNumIdx] && !isNaN(parseInt(cells[killNumIdx]))) {
            killCount++;
            
            const shots = parseIntSafe(cells[shotsIdx]);
            const hits = parseIntSafe(cells[hitsIdx]);
            const overshots = parseIntSafe(cells[overshotsIdx]);
            
            if (killCount <= 3) {
                console.log(`Kill ${killCount}:`, { shots, hits, overshots, raw: cells.slice(0, 10) });
            }
            
            if (shotsIdx >= 0 && shots != null) totalShots += shots;
            if (hitsIdx >= 0 && hits != null) totalHits += hits;
            if (overshotsIdx >= 0 && overshots != null) totalOvershots += overshots;
            
            if (ttkIdx >= 0) {
                const ttk = parseFloatLocale(cells[ttkIdx]?.replace(/s$/, ''));
                if (ttk != null && ttk > 0) {
                    totalTTK += ttk;
                    ttkCount++;
                }
            }
        }
    }
    
    // Calculate Shots from Hit Count + Miss Count if available
    const hitCountValue = parseIntSafe(summaryData['Hit Count']) || parseIntSafe(summaryData['Hit Count:']);
    const missCountValue = parseIntSafe(summaryData['Miss Count']) || parseIntSafe(summaryData['Miss Count:']);
    
    if (hitCountValue != null && missCountValue != null) {
        summaryData['Shots'] = (hitCountValue + missCountValue).toString();
        summaryData['Hits'] = hitCountValue.toString();
    }
    
    // IMPORTANT: Save values from colon versions BEFORE deleting
    const scoreVal = parseFloatLocale(summaryData['Score:'] || summaryData['Score']);
    const scenarioVal = summaryData['Scenario:'] || summaryData['Scenario'];
    const avgTtkVal = parseFloatLocale(summaryData['Avg TTK:'] || summaryData['Avg TTK']);
    const fightTimeVal = parseDurationFlexible(summaryData['Fight Time:'] || summaryData['Fight Time']);
    const overshotsVal = parseIntSafe(summaryData['Total Overshots:'] || summaryData['Total Overshots']);
    const accuracyVal = parsePercentFlexible(summaryData['Accuracy:'] || summaryData['Accuracy']);
    
    // Delete colon versions so mapRow doesn't match them first
    delete summaryData['Score:'];
    delete summaryData['Scenario:'];
    delete summaryData['Hit Count:'];
    delete summaryData['Miss Count:'];
    delete summaryData['Avg TTK:'];
    delete summaryData['Fight Time:'];
    delete summaryData['Total Overshots:'];
    delete summaryData['Accuracy:'];
    
    // Set the clean keys
    if (scoreVal != null) summaryData['Score'] = scoreVal.toString();
    if (scenarioVal) summaryData['Scenario'] = scenarioVal;
    if (avgTtkVal != null) summaryData['Avg TTK'] = avgTtkVal.toString();
    if (fightTimeVal != null) summaryData['Fight Time'] = fightTimeVal.toString();
    if (overshotsVal != null) summaryData['Total Overshots'] = overshotsVal.toString();
    if (accuracyVal != null) summaryData['Accuracy'] = accuracyVal.toString();
    
    // Add calculated stats from kill-by-kill data ONLY if summary data is missing
    if (killCount > 0) {
        // Only use kill-by-kill data if summary stats are not available
        if (!summaryData['Hits'] && !summaryData['Hit Count'] && !summaryData['Hit Count:'] && totalHits > 0) {
            summaryData['Hits'] = totalHits.toString();
        }
        if (!summaryData['Shots'] && totalShots > 0) {
            summaryData['Shots'] = totalShots.toString();
        }
        if (!summaryData['Total Overshots'] && !summaryData['Total Overshots:'] && totalOvershots > 0) {
            summaryData['Total Overshots'] = totalOvershots.toString();
        }
        
        // Calculate accuracy if not present and we have shot data
        const finalShots = parseIntSafe(summaryData['Shots']) || totalShots;
        const finalHits = parseIntSafe(summaryData['Hits']) || parseIntSafe(summaryData['Hit Count']) || totalHits;
        if (finalShots > 0 && !summaryData['Accuracy'] && !summaryData['Accuracy:']) {
            summaryData['Accuracy'] = ((finalHits / finalShots) * 100).toFixed(2);
        }
        
        if (ttkCount > 0 && !summaryData['Avg TTK'] && !summaryData['Avg TTK:']) {
            summaryData['Avg TTK'] = (totalTTK / ttkCount).toFixed(6);
        }
        
        // Calculate duration from first to last kill timestamp (only if not in summary)
        if (timestampIdx >= 0 && !summaryData['Fight Time'] && !summaryData['Fight Time:']) {
            const firstTimestamp = splitCSV(lines[1])[timestampIdx];
            const lastTimestamp = splitCSV(lines[killCount])[timestampIdx];
            if (firstTimestamp && lastTimestamp) {
                const parseTime = (t) => {
                    const parts = t.split(':').map(p => parseFloat(p));
                    return parts[0] * 3600 + parts[1] * 60 + parts[2];
                };
                const duration = parseTime(lastTimestamp) - parseTime(firstTimestamp);
                if (duration > 0) {
                    summaryData['Fight Time'] = duration.toFixed(2);
                }
            }
        }
    }

    // Map the summary data using our keymap
    const result = mapRow(summaryData, filePath);
    
    return result;
}

module.exports = { parseCsvToRun };
