import type { ProgressData, Tier } from "../../types";

export function ProgressBar({ 
  progress, 
  tier 
}: { 
  progress: ProgressData; 
  tier: Tier;
}) {
  const normalXp = Math.min(progress.xp, progress.xpMax);
  const overflowXp = Math.max(0, progress.xp - progress.xpMax);
  const normalPercent = (normalXp / progress.xpMax) * 100;
  const overflowPercent = (overflowXp / (progress.overflowMax - progress.xpMax)) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-text-secondary)' }}>
          Tier XP
        </span>
        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {progress.xp} / {progress.xpMax}
          {progress.isOverflow && (
            <span className="ml-1 text-xs" style={{ color: tier.color }}>
              (+{overflowXp})
            </span>
          )}
        </span>
      </div>
      
      <div 
        className="h-3 rounded-full overflow-hidden relative"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${normalPercent}%`,
            background: tier.gradient,
            opacity: progress.isOverflow ? 0.7 : 1
          }}
        />
        
        {progress.isOverflow && (
          <div
            className="h-full transition-all duration-500 ease-out absolute top-0"
            style={{
              left: '0',
              width: `${Math.min(100, normalPercent + overflowPercent)}%`,
              background: `linear-gradient(90deg, transparent ${(normalPercent / (normalPercent + overflowPercent)) * 100}%, ${tier.color}50 ${(normalPercent / (normalPercent + overflowPercent)) * 100}%)`,
              mixBlendMode: 'lighten'
            }}
          />
        )}
      </div>
      
      {progress.isOverflow && (
        <div className="flex items-center gap-1 text-xs" style={{ color: tier.color }}>
          <span className="font-semibold">🔥 On a heater</span>
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            - Keep it up to maintain your edge!
          </span>
        </div>
      )}
      
      {progress.xpGainLastRun > 0 && (
        <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Last run: <span className="font-semibold text-green-400">+{progress.xpGainLastRun} XP</span>
        </div>
      )}
    </div>
  );
}
