import { useState } from "react";
import type { ComparisonResult, Session } from "../../types/sessions";
import { useQuery } from "../../hooks/useApi";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type ComparisonViewProps = {
  result: ComparisonResult;
  onClose: () => void;
  onRecompare?: (result: ComparisonResult) => void;
};

export default function ComparisonView({ result, onClose, onRecompare }: ComparisonViewProps) {
  const [loading, setLoading] = useState(false);
  const { data: sessions } = useQuery<Session[]>('sessions', '/api/sessions');
  const completedSessions = sessions?.filter(s => s.is_active === 0) || [];
  
  // Extract session IDs if this is a session comparison
  const isSessionComparison = result.meta.leftSessionId && result.meta.rightSessionId;
  const [leftSessionId, setLeftSessionId] = useState(result.meta.leftSessionId || 0);
  const [rightSessionId, setRightSessionId] = useState(result.meta.rightSessionId || 0);

  const handleSessionChange = async () => {
    if (!onRecompare || !isSessionComparison) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/comparisons/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left: { type: 'session', sessionId: leftSessionId },
          right: { type: 'session', sessionId: rightSessionId },
          taskScope: 'all'
        })
      });

      if (!response.ok) throw new Error('Failed to run comparison');
      const newResult = await response.json();
      onRecompare(newResult);
    } catch (error) {
      console.error('Error running comparison:', error);
      alert('Failed to run comparison');
    } finally {
      setLoading(false);
    }
  };
  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '—';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatTTK = (num: number | null) => {
    if (num === null || num === undefined) return '—';
    return num.toFixed(3); // Always show 3 decimal places for TTK
  };

  const formatPercentage = (num: number | null) => {
    if (num === null || num === undefined) return '—';
    return `${num.toFixed(1)}%`;
  };

  const DiffChip = ({ value, pct, metric }: { value: number; pct: number | null; metric: string }) => {
    // For TTK, lower is better; for others, higher is better
    const isImprovement = metric === 'ttk' ? value < 0 : value > 0;
    const color = isImprovement ? 'text-lime-400' : value < 0 ? 'text-red-400' : 'text-theme-muted';
    const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
    
    // Format value based on metric type
    const formattedValue = metric === 'ttk' ? formatTTK(value) : formatNumber(value);

    return (
      <div className={`flex items-center gap-1 ${color} font-medium`}>
        <span className="text-2xl">{arrow}</span>
        <div className="flex flex-col items-start">
          <span>{value > 0 ? '+' : ''}{formattedValue}</span>
          {pct !== null && !isNaN(pct) && (
            <span className="text-xs opacity-75">
              ({pct > 0 ? '+' : ''}{formatPercentage(pct)})
            </span>
          )}
        </div>
      </div>
    );
  };

  const leftLabel = result.labels?.left || 'Left';
  const rightLabel = result.labels?.right || 'Right';

  return (
    <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-3">Comparison Results</h2>
          
          {/* Session Switcher - only show for session comparisons */}
          {isSessionComparison && onRecompare ? (
            <div className="flex items-center gap-4 py-2">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-1 h-10 bg-blue-400 rounded" />
                <select
                  value={leftSessionId}
                  onChange={(e) => setLeftSessionId(parseInt(e.target.value))}
                  className="flex-1 px-4 py-2.5 bg-theme-tertiary border-2 border-blue-400/50 rounded text-white text-sm focus:border-blue-400 focus:outline-none"
                >
                  {completedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              
              <span className="text-theme-muted font-bold text-lg px-2">vs</span>
              
              <div className="flex items-center gap-3 flex-1">
                <select
                  value={rightSessionId}
                  onChange={(e) => setRightSessionId(parseInt(e.target.value))}
                  className="flex-1 px-4 py-2.5 bg-theme-tertiary border-2 border-green-400/50 rounded text-white text-sm focus:border-green-400 focus:outline-none"
                >
                  {completedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <div className="w-1 h-10 bg-green-400 rounded" />
              </div>
              
              {(leftSessionId !== result.meta.leftSessionId || rightSessionId !== result.meta.rightSessionId) && (
                <button
                  onClick={handleSessionChange}
                  disabled={loading}
                  className="px-5 py-2.5 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 disabled:cursor-not-allowed text-white text-sm rounded font-medium transition-colors whitespace-nowrap"
                >
                  {loading ? '...' : 'Compare'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-400 rounded" />
                <span className="text-blue-400 font-semibold">{leftLabel}</span>
                <span className="text-theme-muted text-sm">({result.meta.leftRunCount} runs)</span>
              </div>
              <span className="text-theme-muted">vs</span>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-semibold">{rightLabel}</span>
                <div className="w-1 h-6 bg-green-400 rounded" />
                <span className="text-theme-muted text-sm">({result.meta.rightRunCount} runs)</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-theme-tertiary hover:bg-theme-primary border border-theme-primary rounded-lg text-white transition-colors"
        >
          Close
        </button>
      </div>

      {/* Overall Comparison Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-white mb-4">Overall Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Score Card */}
          <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-5">
            <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Score</p>
            <div className="flex items-center justify-between mb-4">
              <div className="text-center flex-1">
                <p className="text-xs text-blue-400 font-semibold mb-1">{leftLabel}</p>
                <p className="text-2xl font-bold text-blue-400">
                  {formatNumber(result.overall.left.avg_score)}
                </p>
              </div>
              <DiffChip 
                value={result.overall.diffs.score}
                pct={result.overall.diffs.scorePct}
                metric="score"
              />
              <div className="text-center flex-1">
                <p className="text-xs text-green-400 font-semibold mb-1">{rightLabel}</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatNumber(result.overall.right.avg_score)}
                </p>
              </div>
            </div>
            <div className="text-xs text-theme-muted text-center space-y-1">
              <div 
                title="Median (50th percentile) - half of your runs scored above this value"
                className="cursor-help underline decoration-dotted"
              >
                P50: {formatNumber(result.overall.left.score_p50)} / {formatNumber(result.overall.right.score_p50)}
              </div>
              <div 
                title="95th percentile - only 5% of your runs scored above this value"
                className="cursor-help underline decoration-dotted"
              >
                P95: {formatNumber(result.overall.left.score_p95)} / {formatNumber(result.overall.right.score_p95)}
              </div>
            </div>
          </div>

          {/* Accuracy Card */}
          <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-5">
            <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Accuracy</p>
            <div className="flex items-center justify-between mb-4">
              <div className="text-center flex-1">
                <p className="text-xs text-blue-400 mb-1">{leftLabel}</p>
                <p className="text-2xl font-bold text-blue-400">
                  {formatPercentage(result.overall.left.avg_accuracy)}
                </p>
              </div>
              <DiffChip 
                value={result.overall.diffs.accuracy}
                pct={result.overall.diffs.accuracyPct}
                metric="accuracy"
              />
              <div className="text-center flex-1">
                <p className="text-xs text-green-400 mb-1">{rightLabel}</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatPercentage(result.overall.right.avg_accuracy)}
                </p>
              </div>
            </div>
            <div className="text-xs text-theme-muted text-center space-y-1">
              <div 
                title="Median (50th percentile) - half of your runs had accuracy above this value"
                className="cursor-help underline decoration-dotted"
              >
                P50: {formatPercentage(result.overall.left.accuracy_p50)} / {formatPercentage(result.overall.right.accuracy_p50)}
              </div>
              <div 
                title="95th percentile - only 5% of your runs had accuracy above this value"
                className="cursor-help underline decoration-dotted"
              >
                P95: {formatPercentage(result.overall.left.accuracy_p95)} / {formatPercentage(result.overall.right.accuracy_p95)}
              </div>
            </div>
          </div>

          {/* TTK Card */}
          <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-5">
            <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Avg TTK</p>
            <div className="flex items-center justify-between mb-4">
              <div className="text-center flex-1">
                <p className="text-xs text-blue-400 mb-1">{leftLabel}</p>
                <p className="text-2xl font-bold text-blue-400">
                  {formatTTK(result.overall.left.avg_ttk)}s
                </p>
              </div>
              <DiffChip 
                value={result.overall.diffs.ttk}
                pct={result.overall.diffs.ttkPct}
                metric="ttk"
              />
              <div className="text-center flex-1">
                <p className="text-xs text-green-400 mb-1">{rightLabel}</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatTTK(result.overall.right.avg_ttk)}s
                </p>
              </div>
            </div>
            <div className="text-xs text-theme-muted text-center space-y-1">
              <div 
                title="Median (50th percentile) - half of your runs had TTK above this value"
                className="cursor-help underline decoration-dotted"
              >
                P50: {formatTTK(result.overall.left.ttk_p50)}s / {formatTTK(result.overall.right.ttk_p50)}s
              </div>
              <div 
                title="95th percentile - only 5% of your runs had TTK above this value (lower is better)"
                className="cursor-help underline decoration-dotted"
              >
                P95: {formatTTK(result.overall.left.ttk_p95)}s / {formatTTK(result.overall.right.ttk_p95)}s
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task-Specific Comparison Section */}
      {result.meta.hasSharedTasks ? (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">
            Task-Specific Breakdown
            <span className="text-sm font-normal text-theme-muted ml-2">
              ({result.meta.sharedTaskCount} shared tasks)
            </span>
          </h3>
          <div className="space-y-3">
            {result.tasks.map((task) => (
              <div key={task.taskId} className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">{task.taskName}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score */}
                  <div>
                    <p className="text-xs text-theme-muted mb-2">Score</p>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <span className="text-blue-400 font-medium text-lg">
                          {formatNumber(task.left.avgScore)}
                        </span>
                      </div>
                      <span className="text-theme-muted">→</span>
                      <div className="text-center">
                        <span className="text-green-400 font-bold text-lg">
                          {formatNumber(task.right.avgScore)}
                        </span>
                        <div className={`text-sm font-medium flex items-center justify-center gap-1 mt-1 ${
                          task.diff.score > 0 ? 'text-lime-400' : 
                          task.diff.score < 0 ? 'text-red-400' : 'text-theme-muted'
                        }`}>
                          <span>{task.diff.score > 0 ? '↑' : task.diff.score < 0 ? '↓' : '→'}</span>
                          <span>{task.diff.score > 0 ? '+' : ''}{formatNumber(task.diff.score)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accuracy */}
                  <div>
                    <p className="text-xs text-theme-muted mb-2">Accuracy</p>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <span className="text-blue-400 font-medium text-lg">
                          {formatPercentage(task.left.avgAccuracy)}
                        </span>
                      </div>
                      <span className="text-theme-muted">→</span>
                      <div className="text-center">
                        <span className="text-green-400 font-bold text-lg">
                          {formatPercentage(task.right.avgAccuracy)}
                        </span>
                        <div className={`text-sm font-medium flex items-center justify-center gap-1 mt-1 ${
                          task.diff.accuracy > 0 ? 'text-lime-400' : 
                          task.diff.accuracy < 0 ? 'text-red-400' : 'text-theme-muted'
                        }`}>
                          <span>{task.diff.accuracy > 0 ? '↑' : task.diff.accuracy < 0 ? '↓' : '→'}</span>
                          <span>{task.diff.accuracy > 0 ? '+' : ''}{formatPercentage(task.diff.accuracy)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TTK */}
                  <div>
                    <p className="text-xs text-theme-muted mb-2">Avg TTK</p>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <span className="text-blue-400 font-medium text-lg">
                          {formatTTK(task.left.avgTtk)}s
                        </span>
                      </div>
                      <span className="text-theme-muted">→</span>
                      <div className="text-center">
                        <span className="text-green-400 font-bold text-lg">
                          {formatTTK(task.right.avgTtk)}s
                        </span>
                        <div className={`text-sm font-medium flex items-center justify-center gap-1 mt-1 ${
                          task.diff.ttk < 0 ? 'text-lime-400' : 
                          task.diff.ttk > 0 ? 'text-red-400' : 'text-theme-muted'
                        }`}>
                          <span>{task.diff.ttk < 0 ? '↓' : task.diff.ttk > 0 ? '↑' : '→'}</span>
                          <span>{task.diff.ttk > 0 ? '+' : ''}{formatTTK(task.diff.ttk)}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-8 text-center">
          <p className="text-theme-muted">
            No shared tasks between the two windows.
          </p>
          <p className="text-sm text-theme-muted mt-2">
            Overall statistics are still available above.
          </p>
        </div>
      )}
    </div>
  );
}
