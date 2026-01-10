import { useQuery } from "../../hooks/useApi";
import type { CategoryStats, RecentRun } from "../../types";
import { RankBadge } from "./RankBadge";
import { PointsMeter } from "./PointsMeter";
import { RecentRunCard } from "./RecentRunCard";
import { ProgressBar } from "./ProgressBar";

export function CategoryCard({ 
  category, 
  stats 
}: { 
  category: string; 
  stats: CategoryStats; 
}) {
  const { data: recentRunsData } = useQuery<{ recentRuns: RecentRun[] }>(
    `recentRuns-${category}`,
    `/api/ranked/recent-runs/${encodeURIComponent(category)}`
  );
  
  const recentRuns = recentRunsData?.recentRuns || [];

  const cardHeaderColors: Record<string, string> = {
    'Flicking': '#a8523f',
    'Tracking': '#f97316',
    'Target Switching': '#a855f7',
  };
  
  const headerColor = cardHeaderColors[category] || 'var(--color-text-primary)';
  
  return (
    <div 
      className="rounded-lg p-6 border transition-all duration-200 hover:shadow-lg flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: stats.rating !== null && !stats.isProvisional ? stats.tier.color + '40' : 'var(--color-border)',
        height: '600px',
        overflow: 'hidden'
      }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-2" style={{ color: headerColor }}>
            {category}
          </h3>
          {stats.isProvisional && stats.rating !== null && (
            <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 font-medium">
              Provisional
            </span>
          )}
        </div>
        {stats.rating !== null && !stats.isProvisional && (
          <RankBadge tier={stats.tier} size="medium" />
        )}
        {(stats.rating === null || stats.isProvisional) && (
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center border-2 border-dashed flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', aspectRatio: '1/1' }}
          >
            <span className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>Unranked</span>
          </div>
        )}
      </div>
      
      {stats.rating !== null ? (
        <>
          {!stats.isProvisional && stats.points !== null && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Skill Points (Actual Rank)
                </div>
                <PointsMeter points={stats.points} tier={stats.tier} />
              </div>
              
              {stats.progress && (
                <div>
                  <ProgressBar progress={stats.progress} tier={stats.tier} />
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Ranked Runs
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {stats.totalRuns}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Tasks Played
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {stats.distinctTasks}
              </div>
            </div>
          </div>
          
          {stats.isProvisional && (
            <div className="mt-4 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <strong>Provisional Rank:</strong> Play at least 10 runs across 3+ distinct ranked tasks to establish your official rank
              </p>
            </div>
          )}
          
          {recentRuns.length > 0 && (
            <div className="mt-6 flex-1 min-h-0">
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Recent Runs
              </h4>
              <div className="space-y-2 max-h-full overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 2rem)' }}>
                {recentRuns.map((run) => (
                  <RecentRunCard key={run.id} run={run} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            No ranked runs in this category yet
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Play ranked tasks to establish your rating
          </p>
        </div>
      )}
    </div>
  );
}
