import { useState } from "react";
import { useQuery, getApiUrl } from "../hooks/useApi";
import CreateTaskGoalModal from "../components/CreateTaskGoalModal";
import CreatePackGoalModal from "../components/CreatePackGoalModal";
import ConfirmDialog from "../components/ConfirmDialog";

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
  target_pack_id?: number;
  target_pack_name?: string;
  target_timeframe?: number;
  target_date?: string;
  is_user_created?: boolean;
};

type TabType = "overall" | "task" | "pack";

export default function Goals() {
  const [activeTab, setActiveTab] = useState<TabType>("overall");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    goalId: number;
    goalTitle: string;
  }>({ isOpen: false, goalId: 0, goalTitle: '' });
  
  const { data: activeGoals, refetch: refetchActive } = useQuery<Goal[]>("activeGoals", "/api/goals?active=true", {
    refetchInterval: 5000 // Poll every 5 seconds for live updates
  });
  const { data: completedGoals, refetch: refetchCompleted } = useQuery<Goal[]>("completedGoals", "/api/goals?completed=true", {
    refetchInterval: 5000 // Poll every 5 seconds for live updates
  });

  const allGoals = [...(activeGoals || []), ...(completedGoals || [])];
  
  // Filter by tab type first
  const tabFilteredGoals = allGoals.filter(goal => {
    if (activeTab === "overall") {
      // Overall goals are auto-generated and have no task or pack
      return !goal.target_task_name && !goal.target_pack_id;
    } else if (activeTab === "task") {
      // Task goals have a target_task_name
      return !!goal.target_task_name;
    } else if (activeTab === "pack") {
      // Pack goals have a target_pack_id
      return !!goal.target_pack_id;
    }
    return true;
  });
  
  // Then filter by status
  const filteredGoals = tabFilteredGoals.filter(goal => {
    if (filter === "active") return !goal.is_completed;
    if (filter === "completed") return goal.is_completed;
    return true;
  });

  const handleGoalCreated = () => {
    refetchActive();
    refetchCompleted();
    setShowTaskModal(false);
    setShowPackModal(false);
  };

  const handleDeleteGoal = (goalId: number, goalTitle: string) => {
    setDeleteConfirm({ isOpen: true, goalId, goalTitle });
  };

  const confirmDeleteGoal = async () => {
    const { goalId } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, goalId: 0, goalTitle: '' });

    try {
      const response = await fetch(getApiUrl(`/api/goals/${goalId}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        refetchActive();
        refetchCompleted();
      } else {
        const data = await response.json();
        alert(`Failed to delete goal: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('Failed to delete goal');
    }
  };

  const getProgressPercentage = (goal: Goal) => {
    // For TTK (lower is better), calculate inverse progress
    if (goal.goal_type === 'ttk') {
      // If current is already at or below target, 100% complete
      if (goal.current_value <= goal.target_value) return 100;
      
      // Calculate how much we've improved from start
      // Match various description formats
      const descMatch = goal.description.match(/from\s+([\d.]+)s?\s+to\s+([\d.]+)s?/);
      if (descMatch) {
        const startValue = parseFloat(descMatch[1]);
        const targetValue = parseFloat(descMatch[2]);
        const currentValue = goal.current_value;
        
        // Validate we have good numbers
        if (isNaN(startValue) || isNaN(targetValue) || isNaN(currentValue)) {
          return 0;
        }
        
        // Progress = how much we've decreased / how much we need to decrease
        const neededDecrease = startValue - targetValue;
        if (neededDecrease <= 0) {
          return 0;
        }
        
        const actualDecrease = startValue - currentValue;
        const progress = (actualDecrease / neededDecrease) * 100;
        
        // Floor the percentage so we don't show 100% until truly complete
        return Math.max(0, Math.min(99, Math.floor(progress)));
      }
      
      return 0;
    }
    
    // For regular goals (higher is better)
    const progress = (goal.current_value / goal.target_value) * 100;
    
    // Only show 100% when actually >= target, otherwise floor to avoid premature 100%
    if (goal.current_value >= goal.target_value) {
      return 100;
    }
    
    return Math.min(99, Math.floor(progress));
  };

  // Removed emoji icons for cleaner UI

  const getGoalTypeColor = (type: string) => {
    switch (type) {
      case "accuracy": return "bg-green-500";
      case "score": return "bg-theme-accent";
      case "ttk": return "bg-yellow-500";
      case "consistency": return "bg-purple-500";
      case "playtime": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-theme-accent text-white"
                  : "bg-theme-tertiary text-theme-muted hover:border-theme-secondary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "active"
                  ? "bg-green-500 text-white"
                  : "bg-theme-tertiary text-theme-muted hover:border-theme-secondary"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "completed"
                  ? "bg-purple-500 text-white"
                  : "bg-theme-tertiary text-theme-muted hover:border-theme-secondary"
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-t border-theme-primary pt-4">
          <button
            onClick={() => setActiveTab("overall")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "overall"
                ? "bg-theme-accent text-white shadow-lg"
                : "bg-theme-tertiary text-theme-muted hover:text-white"
            }`}
          >
            Overall Goals
          </button>
          <button
            onClick={() => setActiveTab("task")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "task"
                ? "bg-theme-accent text-white shadow-lg"
                : "bg-theme-tertiary text-theme-muted hover:text-white"
            }`}
          >
            Task Goals
          </button>
          <button
            onClick={() => setActiveTab("pack")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "pack"
                ? "bg-theme-accent text-white shadow-lg"
                : "bg-theme-tertiary text-theme-muted hover:text-white"
            }`}
          >
            Pack Goals
          </button>
        </div>

        {/* Add Goal Button */}
        {(activeTab === "task" || activeTab === "pack") && (
          <div className="mt-4">
            <button
              onClick={() => activeTab === "task" ? setShowTaskModal(true) : setShowPackModal(true)}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              + Create {activeTab === "task" ? "Task" : "Pack"} Goal
            </button>
          </div>
        )}
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.length > 0 ? (
          filteredGoals.map(goal => (
            <div
              key={goal.id}
              className={`bg-theme-secondary border rounded-lg p-6 transition-all ${
                goal.is_completed 
                  ? "border-green-500/30 bg-green-500/5" 
                  : "border-theme-primary"
              }`}
            >
              {/* Goal Details */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{goal.title}</h3>
                  <p className="text-sm text-theme-muted mb-3">{goal.description}</p>
                  
                  {/* Current vs Target Stats */}
                  <div className="flex gap-6 mb-3">
                    <div>
                      <span className="text-xs text-theme-muted">Current: </span>
                      <span className="text-sm font-semibold text-blue-400">
                        {goal.goal_type === 'ttk' 
                          ? `${goal.current_value.toFixed(3)}s`
                          : goal.goal_type === 'accuracy'
                          ? `${goal.current_value.toFixed(1)}%`
                          : Math.round(goal.current_value).toLocaleString()
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-theme-muted">Target: </span>
                      <span className="text-sm font-semibold text-theme-accent">
                        {goal.goal_type === 'ttk' 
                          ? `${goal.target_value.toFixed(3)}s`
                          : goal.goal_type === 'accuracy'
                          ? `${goal.target_value.toFixed(1)}%`
                          : Math.round(goal.target_value).toLocaleString()
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-xs text-theme-muted">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getGoalTypeColor(goal.goal_type).replace('bg-', '#') }} />
                      <span className="capitalize">{goal.goal_type}</span>
                    </div>
                    {goal.target_task_name && (
                      <span>Task: {goal.target_task_name}</span>
                    )}
                    {goal.target_pack_name && (
                      <span>Pack: {goal.target_pack_name}</span>
                    )}
                    {goal.target_date && (
                      <span>Target: {formatDate(goal.target_date)}</span>
                    )}
                    {goal.target_timeframe && (
                      <span>Timeframe: {goal.target_timeframe} days</span>
                    )}
                    {goal.is_completed && goal.completed_at && (
                      <span className="text-green-400">Completed: {formatDate(goal.completed_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${
                      goal.is_completed ? "text-green-400" : "text-theme-accent"
                    }`}>
                      {getProgressPercentage(goal)}%
                    </span>
                    <p className="text-xs text-theme-muted mt-1">Progress</p>
                  </div>
                  {goal.is_user_created ? (
                    <button
                      onClick={() => handleDeleteGoal(goal.id, goal.title)}
                      className="text-red-400 hover:text-red-300 transition-colors p-2"
                      title="Delete goal"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-theme-tertiary rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getGoalTypeColor(goal.goal_type)}`}
                    style={{
                      width: `${getProgressPercentage(goal)}%`
                    }}
                  />
                </div>
                {goal.is_completed && (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span className="font-bold">✓</span>
                    <span>Goal Achieved!</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-theme-secondary border border-theme-primary rounded-lg p-12 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              {activeTab === "overall" ? "No Overall Goals" :
               activeTab === "task" ? "No Task Goals" :
               "No Pack Goals"}
            </h3>
            <p className="text-theme-muted text-sm">
              {activeTab === "overall" ? "Play some games to unlock your first goals!" :
               activeTab === "task" ? "Create your first task-specific goal!" :
               "Create your first pack-specific goal!"}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTaskModal && (
        <CreateTaskGoalModal
          onClose={() => setShowTaskModal(false)}
          onGoalCreated={handleGoalCreated}
        />
      )}
      {showPackModal && (
        <CreatePackGoalModal
          onClose={() => setShowPackModal(false)}
          onGoalCreated={handleGoalCreated}
        />
      )}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Goal"
        message={`Are you sure you want to delete "${deleteConfirm.goalTitle}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteGoal}
        onCancel={() => setDeleteConfirm({ isOpen: false, goalId: 0, goalTitle: '' })}
        danger={true}
      />
    </div>
  );
}
