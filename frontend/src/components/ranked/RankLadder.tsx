import type { RankTierInfo } from "../../types";
import rankImages from "../../contexts/rankedImages";

export function RankLadder({ tiers }: { tiers: RankTierInfo[] }) {
  return (
    <div 
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Rank Tiers
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiers.map((tierInfo) => (
          <div
            key={tierInfo.tier}
            className="p-3 rounded-lg border-2 transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${tierInfo.color}15 0%, ${tierInfo.color}05 100%)`,
              borderColor: tierInfo.color + '40'
            }}
          >
            <div className="text-center">
              <div 
                className="text-sm font-bold mb-1"
                style={{ color: tierInfo.color }}
              >
                <div className="flex items-center justify-center">
                  <img src={rankImages[tierInfo.tier]} alt={tierInfo.tier} className="w-12 h-12" />
                </div>
                {tierInfo.tier}
              </div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {tierInfo.minPoints.toLocaleString()} - {tierInfo.maxPoints.toLocaleString()}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {tierInfo.percentileRange}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
