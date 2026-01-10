import { useState } from "react";
import type { RankedTasksResponse } from "../../types";
import { PlaylistCreatorModal } from "./PlaylistCreatorModal";

type AllRankedTasksCardProps = {
  rankedTasks: RankedTasksResponse;
  onShowToast: (message: string) => void;
};

export function AllRankedTasksCard({ rankedTasks, onShowToast }: AllRankedTasksCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPackModal, setShowPackModal] = useState<string | null>(null);
  
  const handleTaskClick = (scenarioName: string) => {
    const encodedName = encodeURIComponent(scenarioName);
    const kovaaksUrl = `https://kovaaks.com/kovaaks/scenarios?scenarioName=${encodedName}`;
    window.open(kovaaksUrl, '_blank');
  };
  
  const categories = [
    { name: 'Flicking', tasks: rankedTasks.Flicking?.tasks || [] },
    { name: 'Tracking', tasks: rankedTasks.Tracking?.tasks || [] },
    { name: 'Target Switching', tasks: rankedTasks['Target Switching']?.tasks || [] }
  ];
  
  const totalTasks = categories.reduce((sum, cat) => sum + cat.tasks.length, 0);
  
  return (
    <div 
      className="rounded-lg border transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-opacity-80 transition-colors"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            All Ranked Tasks ({totalTasks})
          </span>
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
            Click tasks to view in browser
          </span>
        </div>
        <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {categories.map((category) => (
            <div key={category.name} className="mb-6 last:mb-0">
              <div className="flex items-center justify-between sticky top-0 py-2 mb-2" style={{ 
                backgroundColor: 'var(--color-bg-secondary)',
                zIndex: 1
              }}>
                <h4 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {category.name} ({category.tasks.length})
                </h4>
                <button
                  onClick={() => setShowPackModal(category.name)}
                  className="text-xs px-3 py-1 rounded font-medium transition-colors hover:scale-105"
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff'
                  }}
                >
                  Add as Playlist
                </button>
              </div>
              <div className="space-y-2">
                {category.tasks.map((task) => (
                  <button
                    key={task.leaderboardId}
                    onClick={() => handleTaskClick(task.scenarioName)}
                    className="w-full p-3 rounded flex justify-between items-center transition-all hover:scale-[1.01] cursor-pointer"
                    style={{ 
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {task.scenarioName}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {task.userPlays > 0 ? `${task.userPlays} plays` : 'Not played yet'}
                      </div>
                    </div>
                    {task.bestTier && (
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-xs font-bold px-2 py-1 rounded"
                          style={{ 
                            background: task.bestTier.gradient,
                            color: task.bestTier.textColor 
                          }}
                        >
                          {task.bestTier.tier}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {task.bestPercentile !== null ? `${Math.round(task.bestPercentile * 100)}%` : ''}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showPackModal && (
        <PlaylistCreatorModal
          category={showPackModal}
          tasks={categories.find(c => c.name === showPackModal)?.tasks || []}
          onClose={() => setShowPackModal(null)}
          onSuccess={onShowToast}
        />
      )}
    </div>
  );
}
