import { useState, useMemo } from "react";
import ChartHost from "../components/ChartHost";
import TasksTable, { type TaskRow } from "../components/TasksTable";
import { useQuery } from "../hooks/useApi";

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

type Pack = {
  id: number;
  name: string;
  game_focus?: string;
};

type RawTask = {
  task_name?: string; 
  task?: string; 
  filename?: string;
  runs?: number;
  avg_accuracy?: number | null;
  avg_score?: number | null;
  avg_shots?: number | null;
  avg_hits?: number | null;
  avg_ttk?: number | null;
  avg_duration?: number | null;
  avg_overshots?: number | null;
  max_score?: number | null;
  last_played?: string | null;
};

export default function Stats() {
  const [selectedTask, setSelectedTask] = useState("all");
  const [selectedPack, setSelectedPack] = useState("all");
  const [timeframe, setTimeframe] = useState("overall"); // day, week, month, overall

  const tasksUrl = selectedPack && selectedPack !== "all" ? `/api/tasks/summary?pack_id=${selectedPack}` : "/api/tasks/summary";
  const { data: tasksRaw } = useQuery<RawTask[]>("tasksSummary", tasksUrl);
  const { data: packs } = useQuery<Pack[]>("packs", "/api/packs");

  const tasks: TaskRow[] = useMemo(() => {
    const src = tasksRaw ?? [];
    return src.map(t => ({
      task: t.task_name ?? t.task ?? t.filename ?? "Unknown task",
      runs: t.runs ?? 0,
      avgAcc: t.avg_accuracy ?? null,
      avgScore: t.avg_score ?? null,
      avgShots: t.avg_shots ?? null,
      avgHits: t.avg_hits ?? null,
      avgTtk: t.avg_ttk ?? null,
      avgDuration: t.avg_duration ?? null,
      avgOvershots: t.avg_overshots ?? null,
      maxScore: t.max_score ?? null,
      lastPlayed: t.last_played ?? null,
    }));
  }, [tasksRaw]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    // Filter by task name if specified (and not "all")
    if (selectedTask && selectedTask !== "all") {
      filtered = filtered.filter(t => 
        t.task.toLowerCase().includes(selectedTask.toLowerCase())
      );
    }
    
    // Pack filtering is handled by the API call, so no need to filter here
    return filtered;
  }, [tasks, selectedTask]);

  const getTimeframeDays = () => {
    switch (timeframe) {
      case "day": return 1;
      case "week": return 7;
      case "month": return 30;
      default: return null;
    }
  };

  const globalStatsUrl = (() => {
    const params = new URLSearchParams();
    const days = getTimeframeDays();
    if (days !== null) params.append('days', days.toString());
    if (selectedPack && selectedPack !== "all") params.append('pack_id', selectedPack);
    if (selectedTask && selectedTask !== "all") params.append('task', selectedTask);
    const queryString = params.toString();
    return queryString ? `/api/stats/global?${queryString}` : "/api/stats/global";
  })();

  const taskNamesUrl = selectedPack && selectedPack !== "all" 
    ? `/api/tasks/names?pack_id=${selectedPack}`
    : "/api/tasks/names";
  const { data: taskNames } = useQuery<string[]>("taskNames", taskNamesUrl);
  const { data: globalStats } = useQuery<Record<string, number>>("globalStats", globalStatsUrl);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Task
            </label>
            <select
              value={selectedTask || "all"}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="w-full bg-[#0f1320] border border-[#2d3561] text-white px-3 py-2 rounded-lg outline-none"
            >
              <option value="all">All Tasks</option>
              {taskNames?.map((taskName) => (
                <option key={taskName} value={taskName}>
                  {taskName}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Pack
            </label>
            <select
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value)}
              className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Packs</option>
              {packs?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="overall">Overall</option>
            </select>
          </div>
        </div>
        
        {/* Quick Time Filter Buttons */}
        <div className="flex gap-2 mt-4">
          <span className="text-sm text-[#9aa4b2] self-center mr-2">Quick Select:</span>
          {[
            { label: "Today", value: "day" },
            { label: "7 Days", value: "week" },
            { label: "30 Days", value: "month" },
            { label: "All Time", value: "overall" }
          ].map((btn) => (
            <button
              key={btn.value}
              onClick={() => setTimeframe(btn.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                timeframe === btn.value
                  ? "bg-blue-600 text-white"
                  : "bg-[#1b2440] text-[#9aa4b2] hover:bg-[#2d3561] hover:text-white"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Stats Overview */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">
          {selectedTask && selectedTask !== "all" 
            ? `Statistics: ${selectedTask}` 
            : selectedPack && selectedPack !== "all"
            ? `Statistics: ${packs?.find(p => p.id === Number(selectedPack))?.name || 'Selected Pack'}`
            : "Global Statistics"
          }
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{globalStats?.total_runs || 0}</p>
            <p className="text-sm text-[#9aa4b2]">Total Runs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{globalStats?.unique_tasks || 0}</p>
            <p className="text-sm text-[#9aa4b2]">Unique Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {globalStats?.avg_accuracy ? `${globalStats.avg_accuracy.toFixed(1)}%` : "—"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Avg Accuracy</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">
              {globalStats?.avg_score ? Math.round(globalStats.avg_score).toLocaleString() : "—"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Avg Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">
              {globalStats?.avg_ttk ? `${globalStats.avg_ttk.toFixed(3)}s` : "—"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Avg TTK</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-400">
              {globalStats?.total_duration ? formatDuration(globalStats.total_duration) : "0m"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Total Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">
              {globalStats?.total_shots ? globalStats.total_shots.toLocaleString() : "0"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Total Shots</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-pink-400">
              {globalStats?.avg_shots ? Math.round(globalStats.avg_shots).toLocaleString() : "0"}
            </p>
            <p className="text-sm text-[#9aa4b2]">Avg Shots/Run</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <ChartHost
          title={selectedTask && selectedTask !== "all" ? `All Runs - ${selectedTask}` : "Overall Performance Trends"}
          height={400}
          taskName={selectedTask && selectedTask !== "all" ? selectedTask : undefined}
          packId={selectedPack && selectedPack !== "all" ? selectedPack : undefined}
        />
      </div>

      {/* Tasks Table - Hidden when specific task selected to avoid redundancy */}
      {(!selectedTask || selectedTask === "all") && (
        <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
          <TasksTable 
            rows={filteredTasks} 
            onFilter={setSelectedTask}
            onSelectTask={setSelectedTask}
          />
        </div>
      )}
    </div>
  );
}
