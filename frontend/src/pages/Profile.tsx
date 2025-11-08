import { useMemo } from "react";
import { useQuery } from "../hooks/useApi";

type UserProfile = {
  username: string;
  total_runs: number;
  total_playtime: number; // seconds
  unique_tasks?: number;
};

type Goal = {
  id: number;
  title: string;
  description: string;
  current_value: number;
  target_value: number;
  is_completed: boolean;
};

type RunRow = {
  id: number;
  task: string;
  accuracy: number | null;
  score: number | null;
  shots: number | null;
  hits: number | null;
  avg_ttk: number | null;
  duration: number | null;
  played_at: string;
};

type DayRun = {
  id: number;
  task_name: string;
  score: number | null;
  accuracy: number | null;
  avg_ttk: number | null;
  shots: number | null;
  hits: number | null;
  duration: number | null;
  played_at: string;
};

export default function Profile() {
  const { data: profile } = useQuery<UserProfile>("profile", "/api/user/profile");
  const { data: goals } = useQuery<Goal[]>("activeGoals", "/api/goals?active=true&limit=3");
  // Auto-refresh every 30 seconds to pick up new runs
  const { data: todayRuns } = useQuery<DayRun[]>("todayRuns", "/api/runs/by-day?day=today", { refetchInterval: 30000 });
  const { data: yesterdayRuns } = useQuery<DayRun[]>("yesterdayRuns", "/api/runs/by-day?day=yesterday", { refetchInterval: 30000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runsRaw } = useQuery<any[]>("recentRuns", "/api/runs?limit=5");

  const recent: RunRow[] = useMemo(() => {
    const src = runsRaw ?? [];
    return src.map(r => ({
      id: r.id,
      task: r.task_name ?? r.task ?? r.filename ?? "Unknown task",
      accuracy: r.accuracy ?? null,
      score: r.score ?? null,
      shots: r.shots ?? null,
      hits: r.hits ?? null,
      avg_ttk: r.avg_ttk ?? null,
      duration: r.duration ?? null,
      played_at: r.played_at ?? r.created_at ?? "",
    }));
  }, [runsRaw]);

  // Group runs by task and calculate averages for comparison
  const comparisonData = useMemo(() => {
    if (!todayRuns || !yesterdayRuns) return null;
    
    const taskComparisons: Record<string, {
      today: { score: number; accuracy: number; ttk: number; count: number };
      yesterday: { score: number; accuracy: number; ttk: number; count: number };
    }> = {};

    // Process today's runs
    todayRuns.forEach(run => {
      if (!taskComparisons[run.task_name]) {
        taskComparisons[run.task_name] = {
          today: { score: 0, accuracy: 0, ttk: 0, count: 0 },
          yesterday: { score: 0, accuracy: 0, ttk: 0, count: 0 }
        };
      }
      if (run.score !== null) taskComparisons[run.task_name].today.score += run.score;
      if (run.accuracy !== null) taskComparisons[run.task_name].today.accuracy += run.accuracy;
      if (run.avg_ttk !== null) taskComparisons[run.task_name].today.ttk += run.avg_ttk;
      taskComparisons[run.task_name].today.count++;
    });

    // Process yesterday's runs
    yesterdayRuns.forEach(run => {
      if (!taskComparisons[run.task_name]) {
        taskComparisons[run.task_name] = {
          today: { score: 0, accuracy: 0, ttk: 0, count: 0 },
          yesterday: { score: 0, accuracy: 0, ttk: 0, count: 0 }
        };
      }
      if (run.score !== null) taskComparisons[run.task_name].yesterday.score += run.score;
      if (run.accuracy !== null) taskComparisons[run.task_name].yesterday.accuracy += run.accuracy;
      if (run.avg_ttk !== null) taskComparisons[run.task_name].yesterday.ttk += run.avg_ttk;
      taskComparisons[run.task_name].yesterday.count++;
    });

    // Calculate averages and filter tasks that exist in both days
    return Object.entries(taskComparisons)
      .filter(([, data]) => data.today.count > 0 && data.yesterday.count > 0)
      .map(([taskName, data]) => ({
        taskName,
        todayAvg: {
          score: data.today.score / data.today.count,
          accuracy: data.today.accuracy / data.today.count,
          ttk: data.today.ttk / data.today.count,
          runs: data.today.count
        },
        yesterdayAvg: {
          score: data.yesterday.score / data.yesterday.count,
          accuracy: data.yesterday.accuracy / data.yesterday.count,
          ttk: data.yesterday.ttk / data.yesterday.count,
          runs: data.yesterday.count
        },
        scoreDiff: (data.today.score / data.today.count) - (data.yesterday.score / data.yesterday.count),
        accuracyDiff: (data.today.accuracy / data.today.count) - (data.yesterday.accuracy / data.yesterday.count),
        ttkDiff: (data.today.ttk / data.today.count) - (data.yesterday.ttk / data.yesterday.count)
      }));
  }, [todayRuns, yesterdayRuns]);

  const formatPlaytime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getProgressPercentage = (goal: Goal) => {
    // For TTK (lower is better), calculate inverse progress
    if (goal.description && goal.description.includes('TTK')) {
      // If current is already at or below target, 100% complete
      if (goal.current_value <= goal.target_value) return 100;
      
      // Calculate how much we've improved from start
      // Parse starting value from description like "from 1.234s to 0.900s"
      const descMatch = goal.description.match(/from ([\d.]+)s to ([\d.]+)s/);
      if (descMatch) {
        const startValue = parseFloat(descMatch[1]);
        const targetValue = parseFloat(descMatch[2]);
        const currentValue = goal.current_value;
        
        // Progress = how much we've decreased / how much we need to decrease
        const neededDecrease = startValue - targetValue;
        const actualDecrease = startValue - currentValue;
        const progress = (actualDecrease / neededDecrease) * 100;
        
        return Math.max(0, Math.min(100, Math.round(progress)));
      }
    }
    
    // For regular goals (higher is better)
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  };

  return (
    <div className="space-y-4">
      {/* Profile and Goals Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile Card */}
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-white">Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-theme-muted">Username</label>
              <p className="text-lg font-semibold text-white">
                {profile?.username || "Player"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-theme-muted">Total Tasks</label>
                <p className="text-2xl font-bold text-blue-400">
                  {profile?.unique_tasks || 0}
                </p>
              </div>
              <div>
                <label className="text-sm text-theme-muted">Total Runs</label>
                <p className="text-2xl font-bold text-purple-400">
                  {profile?.total_runs || 0}
                </p>
              </div>
              <div>
                <label className="text-sm text-theme-muted">Play Time</label>
                <p className="text-2xl font-bold text-green-400">
                  {profile ? formatPlaytime(profile.total_playtime) : "0h 0m"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-white">Current Goals</h2>
          <div className="space-y-3">
            {goals && goals.length > 0 ? (
              goals.map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">{goal.title}</span>
                    <span className="text-xs text-theme-muted">
                      {getProgressPercentage(goal)}%
                    </span>
                  </div>
                  <div className="w-full bg-theme-tertiary rounded-full h-2">
                    <div
                      className="bg-theme-accent h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${getProgressPercentage(goal)}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-theme-muted text-sm">No active goals. Complete more tasks to unlock goals!</p>
            )}
          </div>
        </div>
      </div>

      {/* Day-to-Day Comparison */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">
          Today vs Yesterday
        </h2>
        
        {comparisonData && comparisonData.length > 0 ? (
          <div className="space-y-4">
            {comparisonData.map((comparison) => (
              <div key={comparison.taskName} className="bg-theme-tertiary rounded-lg p-5 border border-theme-secondary">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">{comparison.taskName}</h3>
                  <div className="text-xs text-theme-muted">
                    <span className="mr-3">Today: {comparison.todayAvg.runs} runs</span>
                    <span>Yesterday: {comparison.yesterdayAvg.runs} runs</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Score Comparison Card */}
                  <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4">
                    <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Score</p>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Today</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {Math.round(comparison.todayAvg.score).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <div className={`text-3xl font-bold leading-none ${
                          comparison.scoreDiff > 0 ? 'text-green-400' : 
                          comparison.scoreDiff < 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.scoreDiff > 0 ? '↑' : comparison.scoreDiff < 0 ? '↓' : '→'}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${
                          comparison.scoreDiff > 0 ? 'text-green-400' : 
                          comparison.scoreDiff < 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.scoreDiff > 0 ? '+' : ''}{Math.round(comparison.scoreDiff)}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Yesterday</p>
                        <p className="text-2xl font-bold text-blue-300 opacity-60">
                          {Math.round(comparison.yesterdayAvg.score).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Accuracy Comparison Card */}
                  <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4">
                    <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Accuracy</p>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Today</p>
                        <p className="text-2xl font-bold text-green-400">
                          {comparison.todayAvg.accuracy.toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <div className={`text-3xl font-bold leading-none ${
                          comparison.accuracyDiff > 0 ? 'text-green-400' : 
                          comparison.accuracyDiff < 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.accuracyDiff > 0 ? '↑' : comparison.accuracyDiff < 0 ? '↓' : '→'}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${
                          comparison.accuracyDiff > 0 ? 'text-green-400' : 
                          comparison.accuracyDiff < 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.accuracyDiff > 0 ? '+' : ''}{comparison.accuracyDiff.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Yesterday</p>
                        <p className="text-2xl font-bold text-green-300 opacity-60">
                          {comparison.yesterdayAvg.accuracy.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* TTK Comparison Card */}
                  <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4">
                    <p className="text-xs text-theme-muted uppercase font-semibold mb-3 text-center">Avg TTK</p>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Today</p>
                        <p className="text-2xl font-bold text-orange-400">
                          {comparison.todayAvg.ttk.toFixed(3)}s
                        </p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <div className={`text-3xl font-bold leading-none ${
                          comparison.ttkDiff < 0 ? 'text-green-400' : 
                          comparison.ttkDiff > 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.ttkDiff < 0 ? '↓' : comparison.ttkDiff > 0 ? '↑' : '→'}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${
                          comparison.ttkDiff < 0 ? 'text-green-400' : 
                          comparison.ttkDiff > 0 ? 'text-red-400' : 
                          'text-theme-muted'
                        }`}>
                          {comparison.ttkDiff > 0 ? '+' : ''}{comparison.ttkDiff.toFixed(3)}s
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-theme-muted mb-1">Yesterday</p>
                        <p className="text-2xl font-bold text-orange-300 opacity-60">
                          {comparison.yesterdayAvg.ttk.toFixed(3)}s
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback to Recent Tasks when no comparison available */
          <div className="space-y-3">
            {todayRuns && todayRuns.length > 0 ? (
              <>
                <p className="text-sm text-theme-muted mb-3">
                  No tasks in common with yesterday. Showing today's runs:
                </p>
                {todayRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="bg-theme-tertiary rounded-lg p-4 border border-theme-secondary">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white truncate flex-1 mr-2">{run.task_name}</h3>
                      <span className="text-xs text-theme-muted whitespace-nowrap">
                        {new Date(run.played_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-theme-muted block">Score</span>
                        <span className="text-blue-400 font-medium">
                          {run.score !== null ? run.score.toLocaleString() : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Accuracy</span>
                        <span className="text-green-400 font-medium">
                          {run.accuracy !== null ? `${run.accuracy.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Avg TTK</span>
                        <span className="text-orange-400 font-medium">
                          {run.avg_ttk !== null ? `${run.avg_ttk.toFixed(3)}s` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : recent.length > 0 ? (
              <>
                <p className="text-sm text-theme-muted mb-3">
                  No runs today. Showing recent tasks:
                </p>
                {recent.map((run) => (
                  <div key={run.id} className="bg-theme-tertiary rounded-lg p-4 border border-theme-secondary">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white truncate flex-1 mr-2">{run.task}</h3>
                      <span className="text-xs text-theme-muted whitespace-nowrap">
                        {new Date(run.played_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-theme-muted block">Score</span>
                        <span className="text-blue-400 font-medium">
                          {run.score !== null ? run.score.toLocaleString() : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Accuracy</span>
                        <span className="text-green-400 font-medium">
                          {run.accuracy !== null ? `${run.accuracy.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Shots/Hits</span>
                        <span className="text-purple-400 font-medium">
                          {run.shots !== null && run.hits !== null ? 
                            `${run.hits}/${run.shots}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Avg TTK</span>
                        <span className="text-orange-400 font-medium">
                          {run.avg_ttk !== null ? `${run.avg_ttk.toFixed(3)}s` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-theme-muted text-sm">No tasks found. Complete some tasks to see them here!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
