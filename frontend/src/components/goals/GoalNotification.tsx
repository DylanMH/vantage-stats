import { useEffect, useState } from 'react';

type Goal = {
  id: number;
  goal_type: string;
  target_value: number;
  current_value: number;
  description: string;
  target_task_name?: string;
  completed_at?: string;
};

type GoalNotificationProps = {
  goal: Goal;
  onClose: () => void;
};

export default function GoalNotification({ goal, onClose }: GoalNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
    
    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getGoalIcon = () => {
    switch (goal.goal_type) {
      case 'score': return '🎯';
      case 'accuracy': return '🎪';
      case 'ttk': return '⚡';
      default: return '🏆';
    }
  };

  const getGoalTitle = () => {
    switch (goal.goal_type) {
      case 'score': return 'Score Goal Achieved!';
      case 'accuracy': return 'Accuracy Goal Achieved!';
      case 'ttk': return 'Speed Goal Achieved!';
      default: return 'Goal Achieved!';
    }
  };

  const formatValue = () => {
    switch (goal.goal_type) {
      case 'accuracy': return `${goal.current_value.toFixed(1)}%`;
      case 'ttk': return `${goal.current_value.toFixed(3)}s`;
      default: return goal.current_value.toLocaleString();
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ minWidth: '320px', maxWidth: '400px' }}
    >
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-2xl p-4 border-2 border-green-300">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-3xl">{getGoalIcon()}</div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg mb-1">
                {getGoalTitle()}
              </h3>
              <p className="text-green-50 text-sm mb-2">
                {goal.description}
              </p>
              <div className="flex items-center gap-2 text-white text-sm font-semibold">
                <span>Achieved:</span>
                <span className="bg-white/20 px-2 py-1 rounded">
                  {formatValue()}
                </span>
              </div>
              {goal.target_task_name && (
                <p className="text-green-50 text-xs mt-1 opacity-90">
                  Task: {goal.target_task_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:text-green-100 transition-colors ml-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
