import type { RecentRun } from "../../types/ranked";
import RankImages from "../../contexts/rankedImages";

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function RecentRunCard({ run }: { run: RecentRun }) {
  const playedDate = new Date(run.playedAt);
  const timeAgo = getTimeAgo(playedDate);

  const tierImage = RankImages[run.tier?.tier || ''] || '';
  
  return (
    <div 
      className="p-3 rounded transition-all"
      style={{ 
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)'
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {run.taskName}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {timeAgo} • Score: {run.score.toLocaleString()}
          </div>
        </div>
      </div>
      {run.tier && (
        <div className="flex items-center gap-2 justify-between">
          <span 
            className="flex items-center gap-2 text-xs font-bold px-2 py-1 rounded"
            style={{ 
              background: run.tier.gradient,
              color: run.tier.textColor 
            }}
          >
            {run.tier.tier}
            <img src={tierImage} alt={run.tier.tier} className="w-4 h-4" />
          </span>
          <div className="flex items-center gap-2">
            {run.xpGain !== undefined && run.xpGain > 0 && (
              <span 
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e'
                }}
              >
                +{run.xpGain} XP
              </span>
            )}
            <span className="text-xs font-semibold" style={{ color: run.tier.color }}>
              {run.points}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
