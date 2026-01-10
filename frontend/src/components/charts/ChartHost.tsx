import { useState, useEffect, useMemo } from "react";
import Section from "../ui/Section";
import Chart from "./Chart";
import { getApiUrl } from "../../hooks/useApi";

type ChartData = {
    played_at: string;
    accuracy: number | null;
    score: number | null;
    avg_ttk: number | null;
    shots: number | null;
    hits: number | null;
    duration: number | null;
    task_name?: string; // Only present when viewing all tasks
    dpi?: number | null;
    sens_h?: number | null;
    fov?: number | null;
};

type BestSettings = {
    score: number;
    accuracy: number;
    played_at: string;
    avg_ttk: number | null;
    shots: number | null;
    hits: number | null;
    duration: number | null;
    fps_avg: number | null;
    overshots: number | null;
    reloads: number | null;
    dpi: number | null;
    sens_h: number | null;
    fov: number | null;
    task_name: string;
};

type ChartHostProps = {
    title: string;
    height?: number;
    taskName?: string;
    packId?: string;
    timeframe?: string; // 'day', 'week', 'month', 'overall'
    isPractice?: boolean; // If true, fetch practice mode data
};

// Calculate weighted moving average for smoother results
const calculateMovingAverage = (data: number[], windowSize: number = 15): number[] => {
    if (data.length < 3) return data;
    
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - halfWindow);
        const end = Math.min(data.length, i + halfWindow + 1);
        const window = data.slice(start, end);
        
        // Weighted average: center point gets more weight
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let j = 0; j < window.length; j++) {
            const distance = Math.abs(j - (i - start));
            const weight = Math.max(1, halfWindow - distance);
            weightedSum += window[j] * weight;
            totalWeight += weight;
        }
        
        result.push(weightedSum / totalWeight);
    }
    return result;
};

export default function ChartHost({ title, height = 400, taskName, packId, timeframe = 'overall', isPractice = false }: ChartHostProps) {
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [bestSettings, setBestSettings] = useState<BestSettings | null>(null);
    const [bestFilter, setBestFilter] = useState<'score' | 'accuracy' | 'ttk'>('score');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showBestModal, setShowBestModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayRuns, setDayRuns] = useState<ChartData[]>([]);

    useEffect(() => {
        fetchChartData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskName, packId, bestFilter, timeframe]);

    const getTimeframeDays = () => {
        switch (timeframe) {
            case 'day': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'overall': return null;
            default: return null;
        }
    };

    const fetchChartData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const days = getTimeframeDays();
            
            if (taskName) {
                // Build URL with optional days parameter
                const baseUrl = isPractice ? '/api/practice/runs' : '/api/runs';
                let url = `${baseUrl}?task=${encodeURIComponent(taskName)}&limit=100`;
                if (days !== null) {
                    url += `&days=${days}`;
                }
                
                const runsResponse = await fetch(getApiUrl(url));
                if (runsResponse.ok) {
                    const data = await runsResponse.json();
                    setChartData(data);
                } else {
                    setError('Failed to fetch task data');
                }
                
                // Best settings not available for practice mode yet
                if (!isPractice) {
                    const settingsResponse = await fetch(getApiUrl(`/api/tasks/${encodeURIComponent(taskName)}/best-settings?filterBy=${bestFilter}`));
                    if (settingsResponse.ok) {
                        const settings = await settingsResponse.json();
                        setBestSettings(settings);
                    }
                } else {
                    setBestSettings(null);
                }
            } else {
                // Build query string with optional playlist_id and days
                const params = new URLSearchParams();
                if (packId) {
                    params.append('pack_id', packId);
                }
                if (days !== null) {
                    params.append('days', days.toString());
                }
                const queryString = params.toString();
                const baseUrl = isPractice ? '/api/practice/stats/history' : '/api/stats/history';
                const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
                
                const historyResponse = await fetch(getApiUrl(url));
                if (historyResponse.ok) {
                    const data = await historyResponse.json();
                    setChartData(data);
                } else {
                    setError('Failed to fetch performance history');
                }
                setBestSettings(null);
            }
        } catch {
            setError('Error fetching chart data');
        } finally {
            setLoading(false);
        }
    };

    const handleDateClick = (clickedDate: string) => {
        // Get the date without time for comparison
        const clickedDay = new Date(clickedDate).toLocaleDateString();
        
        // Filter all runs from that day
        const runsOnDay = chartData.filter(run => {
            const runDay = new Date(run.played_at).toLocaleDateString();
            return runDay === clickedDay;
        });
        
        setDayRuns(runsOnDay);
        setSelectedDate(clickedDay);
    };

    // Prepare chart data with smoothing
    const scoreData = useMemo(() => {
        const filtered = chartData.filter(d => d.score !== null);
        const scores = filtered.map(d => d.score!);
        const smoothed = calculateMovingAverage(scores, 15);
        return smoothed.map((value, i) => ({
            value,
            date: filtered[i].played_at
        }));
    }, [chartData]);

    const accuracyData = useMemo(() => {
        const filtered = chartData.filter(d => d.accuracy !== null);
        const accuracies = filtered.map(d => d.accuracy!);
        const smoothed = calculateMovingAverage(accuracies, 15);
        return smoothed.map((value, i) => ({
            value,
            date: filtered[i].played_at
        }));
    }, [chartData]);

    const ttkData = useMemo(() => {
        const filtered = chartData.filter(d => d.avg_ttk !== null);
        const ttks = filtered.map(d => d.avg_ttk!);
        const smoothed = calculateMovingAverage(ttks, 15);
        return smoothed.map((value, i) => ({
            value,
            date: filtered[i].played_at
        }));
    }, [chartData]);

    // Stats calculations
    const avgAccuracy = useMemo(() => {
        const filtered = chartData.filter(d => d.accuracy !== null);
        if (filtered.length === 0) return null;
        return filtered.reduce((sum, d) => sum + d.accuracy!, 0) / filtered.length;
    }, [chartData]);

    const avgScore = useMemo(() => {
        const filtered = chartData.filter(d => d.score !== null);
        if (filtered.length === 0) return null;
        return filtered.reduce((sum, d) => sum + d.score!, 0) / filtered.length;
    }, [chartData]);

    const avgTtk = useMemo(() => {
        const filtered = chartData.filter(d => d.avg_ttk !== null);
        if (filtered.length === 0) return null;
        return filtered.reduce((sum, d) => sum + d.avg_ttk!, 0) / filtered.length;
    }, [chartData]);

    return (
        <Section title={title} className="p-0">
            <div className="p-4" style={{ height }}>
                {loading ? (
                    <div className="h-full w-full grid place-items-center text-[--color-muted]">
                        <div className="text-sm">Loading chart data...</div>
                    </div>
                ) : error ? (
                    <div className="h-full w-full grid place-items-center text-red-400">
                        <div className="text-sm">{error}</div>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-full w-full grid place-items-center text-[--color-muted]">
                        <div className="text-sm">No data available</div>
                    </div>
                ) : (
                    <div className="h-full space-y-6 overflow-y-auto">
                        {/* Best Performance Filter Selector */}
                        {taskName && (
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-theme-muted">Show Best:</label>
                                <select
                                    value={bestFilter}
                                    onChange={(e) => setBestFilter(e.target.value as 'score' | 'accuracy' | 'ttk')}
                                    className="px-3 py-1.5 bg-theme-tertiary border border-theme-secondary rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
                                >
                                    <option value="score">Highest Score</option>
                                    <option value="accuracy">Best Accuracy</option>
                                    <option value="ttk">Fastest TTK</option>
                                </select>
                            </div>
                        )}
                        
                        {/* Best Performance Settings with View button */}
                        {bestSettings && (bestSettings.dpi || bestSettings.sens_h || bestSettings.fov) && (
                            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                                        Best Performance Settings
                                        {bestFilter === 'score' && (
                                            <span className="text-xs text-theme-muted font-normal ml-2">
                                                (Score: {bestSettings.score?.toLocaleString()} | {bestSettings.accuracy?.toFixed(1)}% Accuracy)
                                            </span>
                                        )}
                                        {bestFilter === 'accuracy' && (
                                            <span className="text-xs text-theme-muted font-normal ml-2">
                                                ({bestSettings.accuracy?.toFixed(1)}% Accuracy | Score: {bestSettings.score?.toLocaleString()})
                                            </span>
                                        )}
                                        {bestFilter === 'ttk' && (
                                            <span className="text-xs text-theme-muted font-normal ml-2">
                                                (TTK: {bestSettings.avg_ttk?.toFixed(3)}s | Score: {bestSettings.score?.toLocaleString()})
                                            </span>
                                        )}
                                    </h4>
                                    <button
                                        onClick={() => setShowBestModal(true)}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                        View Full Run
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    {bestSettings.dpi && (
                                        <div>
                                            <p className="text-lg font-bold text-white">{bestSettings.dpi}</p>
                                            <p className="text-xs text-theme-muted">DPI</p>
                                        </div>
                                    )}
                                    {bestSettings.sens_h && (
                                        <div>
                                            <p className="text-lg font-bold text-white">{bestSettings.sens_h.toFixed(3)}</p>
                                            <p className="text-xs text-theme-muted">Sensitivity</p>
                                        </div>
                                    )}
                                    {bestSettings.fov && (
                                        <div>
                                            <p className="text-lg font-bold text-white">{bestSettings.fov}°</p>
                                            <p className="text-xs text-theme-muted">FOV</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Performance Charts with Interactive Tooltips */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-theme-hover border border-theme-secondary rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-white mb-3">Score Over Time</h4>
                                <div className="h-32">
                                    <Chart 
                                        data={scoreData} 
                                        color="var(--color-chart-score, #8b5cf6)" 
                                        label="Score" 
                                        onPointClick={(date) => handleDateClick(date)} 
                                    />
                                </div>
                            </div>

                            <div className="bg-theme-hover border border-theme-secondary rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-white mb-3">Accuracy Over Time</h4>
                                <div className="h-32">
                                    <Chart 
                                        data={accuracyData} 
                                        color="var(--color-chart-accuracy, #10b981)" 
                                        label="Accuracy" 
                                        onPointClick={(date) => handleDateClick(date)} 
                                    />
                                </div>
                            </div>

                            <div className="bg-theme-hover border border-theme-secondary rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-white mb-3">Reaction Time (TTK)</h4>
                                <div className="h-32">
                                    <Chart 
                                        data={ttkData} 
                                        color="var(--color-chart-ttk, #f97316)" 
                                        label="TTK (Lower is Better)" 
                                        onPointClick={(date) => handleDateClick(date)} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-[#1d2230]">
                            <div className="text-center">
                                <p className="text-lg font-bold text-blue-400">{chartData.length}</p>
                                <p className="text-xs text-theme-muted">Total Runs</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-green-400">
                                    {avgAccuracy !== null ? `${avgAccuracy.toFixed(1)}%` : "—"}
                                </p>
                                <p className="text-xs text-theme-muted">Avg Accuracy</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-purple-400">
                                    {avgScore !== null ? Math.round(avgScore).toLocaleString() : "—"}
                                </p>
                                <p className="text-xs text-theme-muted">Avg Score</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-orange-400">
                                    {avgTtk !== null ? `${avgTtk.toFixed(3)}s` : "—"}
                                </p>
                                <p className="text-xs text-theme-muted">Avg TTK</p>
                            </div>
                        </div>

                        {/* Recent Runs Table */}
                        <div>
                            <h4 className="text-sm font-semibold text-white mb-3">
                                Recent Runs ({Math.min(20, chartData.length)} of {chartData.length} total)
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 [&>th]:border-b [&>th]:border-[#1d2230] text-theme-muted">
                                            {!taskName && <th>Task</th>}
                                            <th>Date & Time</th>
                                            <th>Accuracy</th>
                                            <th>Score</th>
                                            <th>TTK</th>
                                            <th>Shots</th>
                                            <th>Hits</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&>tr:hover]:bg-[#111623] [&>tr>td]:py-2 [&>tr>td]:px-2 [&>tr>td]:border-b [&>tr>td]:border-[#1d2230]">
                                        {chartData.slice(0, 20).map((data, index) => (
                                            <tr key={index}>
                                                {!taskName && (
                                                    <td className="text-white max-w-[200px] truncate" title={data.task_name}>
                                                        {data.task_name || '—'}
                                                    </td>
                                                )}
                                                <td className="whitespace-nowrap text-white">
                                                    {new Date(data.played_at).toLocaleDateString()} {new Date(data.played_at).toLocaleTimeString()}
                                                </td>
                                                <td className={`font-medium ${
                                                    data.accuracy !== null && data.accuracy >= 80 ? "text-green-400" : 
                                                    data.accuracy !== null && data.accuracy >= 60 ? "text-yellow-400" : 
                                                    data.accuracy !== null ? "text-red-400" : "text-theme-muted"
                                                }`}>
                                                    {data.accuracy !== null ? `${data.accuracy.toFixed(1)}%` : "—"}
                                                </td>
                                                <td className="text-blue-400">
                                                    {data.score !== null ? data.score.toLocaleString() : "—"}
                                                </td>
                                                <td className="text-orange-400">
                                                    {data.avg_ttk !== null ? `${data.avg_ttk.toFixed(3)}s` : "—"}
                                                </td>
                                                <td className="text-purple-400">
                                                    {data.shots !== null ? data.shots.toLocaleString() : "—"}
                                                </td>
                                                <td className="text-green-400">
                                                    {data.hits !== null ? data.hits.toLocaleString() : "—"}
                                                </td>
                                                <td className="text-cyan-400">
                                                    {data.duration !== null ? `${data.duration.toFixed(1)}s` : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

{/* Day Runs Modal */}
{selectedDate && dayRuns.length > 0 && (
<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
<div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-6 max-w-5xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
<div className="flex items-center justify-between mb-4">
<div>
<h3 className="text-xl font-bold text-white">Runs on {selectedDate}</h3>
<p className="text-sm text-theme-muted mt-1">{dayRuns.length} run{dayRuns.length > 1 ? 's' : ''} found</p>
</div>
<button
onClick={() => setSelectedDate(null)}
className="text-theme-muted hover:text-white text-2xl leading-none"
>
×
</button>
</div>
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="[&>th]:text-left [&>th]:py-3 [&>th]:px-3 [&>th]:border-b [&>th]:border-[#1d2230] text-theme-muted">
{!taskName && <th>Task</th>}
<th>Time</th>
<th>Score</th>
<th>Accuracy</th>
<th>TTK</th>
<th>Shots</th>
<th>Hits</th>
<th>DPI</th>
<th>Sens</th>
<th>FOV</th>
</tr>
</thead>
<tbody className="[&>tr:hover]:bg-[#111623] [&>tr>td]:py-3 [&>tr>td]:px-3 [&>tr>td]:border-b [&>tr>td]:border-[#1d2230]">
{dayRuns.map((run, index) => (
<tr key={index}>
{!taskName && (
<td className="text-white max-w-[200px] truncate" title={run.task_name}>
{run.task_name || '—'}
</td>
)}
<td className="text-white whitespace-nowrap">
{new Date(run.played_at).toLocaleTimeString()}
</td>
<td className="text-blue-400 font-semibold">
{run.score !== null ? run.score.toLocaleString() : '—'}
</td>
<td className={`font-semibold ${
run.accuracy !== null && run.accuracy >= 80 ? "text-green-400" : 
run.accuracy !== null && run.accuracy >= 60 ? "text-yellow-400" : 
run.accuracy !== null ? "text-red-400" : "text-theme-muted"
}`}>
{run.accuracy !== null ? `${run.accuracy.toFixed(1)}%` : '—'}
</td>
<td className="text-orange-400">
{run.avg_ttk !== null ? `${run.avg_ttk.toFixed(3)}s` : '—'}
</td>
<td className="text-purple-400">
{run.shots !== null ? run.shots.toLocaleString() : '—'}
</td>
<td className="text-green-400">
{run.hits !== null ? run.hits.toLocaleString() : '—'}
</td>
<td className="text-cyan-400">
{run.dpi || '—'}
</td>
<td className="text-cyan-400">
{run.sens_h ? run.sens_h.toFixed(3) : '—'}
</td>
<td className="text-cyan-400">
{run.fov ? `${run.fov}°` : '—'}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
)}

{/* Best Performance Modal */}
{showBestModal && bestSettings && (
<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowBestModal(false)}>
<div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
<div className="flex items-center justify-between mb-4">
<div>
<h3 className="text-xl font-bold text-white">Best Performance Run</h3>
<p className="text-sm text-purple-400 mt-1">{bestSettings.task_name}</p>
</div>
<button
onClick={() => setShowBestModal(false)}
className="text-theme-muted hover:text-white text-2xl leading-none"
>
×
</button>
</div>
<div className="space-y-4">
{/* Primary Stats */}
<div className="grid grid-cols-2 gap-4">
<div className="bg-theme-secondary rounded-lg p-4">
<p className="text-sm text-theme-muted mb-1">Score</p>
<p className="text-2xl font-bold text-blue-400">{bestSettings.score?.toLocaleString()}</p>
</div>
<div className="bg-theme-secondary rounded-lg p-4">
<p className="text-sm text-theme-muted mb-1">Accuracy</p>
<p className="text-2xl font-bold text-green-400">{bestSettings.accuracy?.toFixed(1)}%</p>
</div>
</div>
{/* Additional Stats Grid */}
<div className="grid grid-cols-3 gap-3">
{bestSettings.avg_ttk !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Avg TTK</p>
<p className="text-lg font-bold text-orange-400">{bestSettings.avg_ttk.toFixed(3)}s</p>
</div>
)}
{bestSettings.shots !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Shots</p>
<p className="text-lg font-bold text-purple-400">{bestSettings.shots.toLocaleString()}</p>
</div>
)}
{bestSettings.hits !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Hits</p>
<p className="text-lg font-bold text-green-400">{bestSettings.hits.toLocaleString()}</p>
</div>
)}
{bestSettings.duration !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Duration</p>
<p className="text-lg font-bold text-cyan-400">{bestSettings.duration.toFixed(1)}s</p>
</div>
)}
{bestSettings.fps_avg !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Avg FPS</p>
<p className="text-lg font-bold text-yellow-400">{Math.round(bestSettings.fps_avg)}</p>
</div>
)}
{bestSettings.overshots !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Overshots</p>
<p className="text-lg font-bold text-red-400">{bestSettings.overshots}</p>
</div>
)}
{bestSettings.reloads !== null && (
<div className="bg-theme-secondary rounded-lg p-3">
<p className="text-xs text-theme-muted mb-1">Reloads</p>
<p className="text-lg font-bold text-pink-400">{bestSettings.reloads}</p>
</div>
)}
</div>
{/* Date */}
<div className="bg-theme-secondary rounded-lg p-4">
<p className="text-sm text-theme-muted mb-2">Date & Time</p>
<p className="text-lg text-white">{new Date(bestSettings.played_at).toLocaleString()}</p>
</div>
{/* Settings */}
{(bestSettings.dpi || bestSettings.sens_h || bestSettings.fov) && (
<div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4">
<h4 className="text-sm font-semibold text-purple-300 mb-3">Settings Used</h4>
<div className="grid grid-cols-3 gap-4 text-center">
{bestSettings.dpi && (
<div>
<p className="text-2xl font-bold text-white">{bestSettings.dpi}</p>
<p className="text-xs text-theme-muted">DPI</p>
</div>
)}
{bestSettings.sens_h && (
<div>
<p className="text-2xl font-bold text-white">{bestSettings.sens_h.toFixed(3)}</p>
<p className="text-xs text-theme-muted">Sensitivity</p>
</div>
)}
{bestSettings.fov && (
<div>
<p className="text-2xl font-bold text-white">{bestSettings.fov}°</p>
<p className="text-xs text-theme-muted">FOV</p>
</div>
)}
</div>
</div>
)}
</div>
</div>
</div>
)}
</div>
</Section>
    );
}
