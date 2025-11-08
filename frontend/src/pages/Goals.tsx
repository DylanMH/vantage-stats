import { useState } from "react";
import { useQuery } from "../hooks/useApi";

type Goal = {
  id: number;
  title: string;
  description: string;
  goal_type: string;
  current_value: number;
  target_value: number;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  target_task_name?: string;
  target_timeframe?: number;
};

export default function Goals() {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  
  const { data: activeGoals } = useQuery<Goal[]>("activeGoals", "/api/goals?active=true");
  const { data: completedGoals } = useQuery<Goal[]>("completedGoals", "/api/goals?completed=true");

  const allGoals = [...(activeGoals || []), ...(completedGoals || [])];
  
  const filteredGoals = allGoals.filter(goal => {
    if (filter === "active") return !goal.is_completed;
    if (filter === "completed") return goal.is_completed;
    return true;
  });

  const getProgressPercentage = (goal: Goal) => {
    // For TTK (lower is better), calculate inverse progress
    if (goal.goal_type === 'ttk') {
      // If current is already at or below target, 100% complete
      if (goal.current_value <= goal.target_value) return 100;
      
      // Calculate how much we've improved from start
      // We need to infer the starting value from the description
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

  const getGoalTypeIcon = (type: string) => {
    switch (type) {
      case "accuracy": return "🎯";
      case "score": return "⭐";
      case "ttk": return "⚡";
      case "consistency": return "📈";
      case "playtime": return "⏱️";
      default: return "🎯";
    }
  };

  const getGoalTypeColor = (type: string) => {
    switch (type) {
      case "accuracy": return "bg-green-500";
      case "score": return "bg-blue-500";
      case "ttk": return "bg-yellow-500";
      case "consistency": return "bg-purple-500";
      case "playtime": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatGoalValue = (value: number, goalType: string) => {
    if (goalType === 'ttk') {
      return `${value.toFixed(3)}s`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-[#1b2440] text-[#9aa4b2] hover:bg-[#2d3561]"
              }`}
            >
              All ({allGoals.length})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "active"
                  ? "bg-green-500 text-white"
                  : "bg-[#1b2440] text-[#9aa4b2] hover:bg-[#2d3561]"
              }`}
            >
              Active ({activeGoals?.length || 0})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "completed"
                  ? "bg-purple-500 text-white"
                  : "bg-[#1b2440] text-[#9aa4b2] hover:bg-[#2d3561]"
              }`}
            >
              Completed ({completedGoals?.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.length > 0 ? (
          filteredGoals.map(goal => (
            <div
              key={goal.id}
              className={`bg-[#0d1424] border rounded-lg p-6 transition-all ${
                goal.is_completed 
                  ? "border-green-500/30 bg-green-500/5" 
                  : "border-[#1b2440]"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getGoalTypeIcon(goal.goal_type)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-sm text-[#9aa4b2] mt-1">{goal.description}</p>
                    )}
                    {goal.target_task_name && (
                      <p className="text-xs text-blue-400 mt-1">Task: {goal.target_task_name}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#9aa4b2]">
                      <span>Created: {formatDate(goal.created_at)}</span>
                      {goal.target_timeframe && (
                        <span>Timeframe: {goal.target_timeframe} days</span>
                      )}
                      {goal.is_completed && goal.completed_at && (
                        <span className="text-green-400">Completed: {formatDate(goal.completed_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {formatGoalValue(goal.current_value, goal.goal_type)} / {formatGoalValue(goal.target_value, goal.goal_type)}
                  </div>
                  <div className="text-xs text-[#9aa4b2]">
                    {getProgressPercentage(goal)}% complete
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-[#1b2440] rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getGoalTypeColor(goal.goal_type)}`}
                    style={{
                      width: `${getProgressPercentage(goal)}%`
                    }}
                  />
                </div>
                {goal.is_completed && (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span>✓</span>
                    <span>Goal Achieved!</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {filter === "active" ? "No Active Goals" : 
               filter === "completed" ? "No Completed Goals" : 
               "No Goals Yet"}
            </h3>
            <p className="text-[#9aa4b2] text-sm">
              {filter === "active" ? "Complete more tasks to generate new goals!" :
               filter === "completed" ? "Start achieving your goals to see them here!" :
               "Play some games to unlock your first goals!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
