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

export default function Profile() {
  const { data: profile } = useQuery<UserProfile>("profile", "/api/user/profile");
  const { data: goals } = useQuery<Goal[]>("activeGoals", "/api/goals?active=true&limit=3");
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
        <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-white">Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[#9aa4b2]">Username</label>
              <p className="text-lg font-semibold text-white">
                {profile?.username || "Player"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[#9aa4b2]">Total Tasks</label>
                <p className="text-2xl font-bold text-blue-400">
                  {profile?.unique_tasks || 0}
                </p>
              </div>
              <div>
                <label className="text-sm text-[#9aa4b2]">Total Runs</label>
                <p className="text-2xl font-bold text-purple-400">
                  {profile?.total_runs || 0}
                </p>
              </div>
              <div>
                <label className="text-sm text-[#9aa4b2]">Play Time</label>
                <p className="text-2xl font-bold text-green-400">
                  {profile ? formatPlaytime(profile.total_playtime) : "0h 0m"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-white">Current Goals</h2>
          <div className="space-y-3">
            {goals && goals.length > 0 ? (
              goals.map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">{goal.title}</span>
                    <span className="text-xs text-[#9aa4b2]">
                      {getProgressPercentage(goal)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1b2440] rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${getProgressPercentage(goal)}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[#9aa4b2] text-sm">No active goals. Complete more tasks to unlock goals!</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Recent Tasks</h2>
        <div className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-[#9aa4b2] text-sm">No recent tasks found. Complete some tasks to see them here!</p>
          ) : (
            recent.map((run) => (
              <div key={run.id} className="bg-[#1b2440] rounded-lg p-4 border border-[#2d3561]">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white truncate flex-1 mr-2">{run.task}</h3>
                  <span className="text-xs text-[#9aa4b2] whitespace-nowrap">
                    {new Date(run.played_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-[#9aa4b2] block">Score</span>
                    <span className="text-blue-400 font-medium">
                      {run.score !== null ? run.score.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9aa4b2] block">Accuracy</span>
                    <span className={`font-medium ${
                      run.accuracy !== null && run.accuracy >= 80 ? "text-green-400" : 
                      run.accuracy !== null && run.accuracy >= 60 ? "text-yellow-400" : 
                      "text-red-400"
                    }`}>
                      {run.accuracy !== null ? `${run.accuracy.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9aa4b2] block">Shots/Hits</span>
                    <span className="text-purple-400 font-medium">
                      {run.shots !== null && run.hits !== null ? 
                        `${run.hits}/${run.shots}` : 
                        run.shots !== null ? `${run.shots}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9aa4b2] block">Avg TTK</span>
                    <span className="text-orange-400 font-medium">
                      {run.avg_ttk !== null ? `${run.avg_ttk.toFixed(3)}s` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
