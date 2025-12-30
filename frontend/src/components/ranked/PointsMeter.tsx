import type { Tier } from "../../types/ranked";

export function PointsMeter({ points, tier }: { points: number; tier: Tier }) {
  const maxPoints = 3000;
  const progress = (points / maxPoints) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Rating Points
        </span>
        <span className="text-2xl font-bold" style={{ color: tier.color }}>
          {points.toLocaleString()}
        </span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${progress}%`,
            background: tier.gradient
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <span>0</span>
        <span>{maxPoints.toLocaleString()}</span>
      </div>
    </div>
  );
}
