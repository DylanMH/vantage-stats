import type { Tier } from "../../types/ranked";

export function PointsMeter({ points, tier }: { points: number; tier: Tier }) {
  const currentTierMin = tier.minPoints;
  const currentTierMax = tier.maxPoints;
  const pointsInTier = points - currentTierMin;
  const tierRange = currentTierMax - currentTierMin;
  const progress = tierRange > 0 ? (pointsInTier / tierRange) * 100 : 0;
  const pointsToNext = Math.max(0, currentTierMax - points);
  
  const isMaxTier = tier.tier === 'Champion' && points >= currentTierMax;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {isMaxTier ? 'Max Rank' : 'To Next Tier'}
        </span>
        <span className="text-2xl font-bold" style={{ color: tier.color }}>
          {isMaxTier ? points.toLocaleString() : pointsToNext.toLocaleString()}
        </span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${Math.min(100, progress)}%`,
            background: tier.gradient
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <span>{points.toLocaleString()}</span>
        <span>{currentTierMax.toLocaleString()}</span>
      </div>
    </div>
  );
}
