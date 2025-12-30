import type { Tier } from "../../types/ranked";
import rankImages from "../../contexts/rankedImages";

export function RankBadge({ tier, size = 'medium' }: { tier: Tier; size?: 'small' | 'medium' | 'large' }) {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };
  
  const tierImage = rankImages[tier.tier];
  
  return (
    <div 
      className={`${sizeClasses[size]} items-center justify-center transition-all duration-300`}
      style={{ 
        filter: `drop-shadow(0 4px 20px ${tier.color}40)`
      }}
    >
      <div style={{ fontSize: size === 'small' ? '.5rem' : size === 'medium' ? '1rem' : '2rem', color: tier.color }} className="text-center text-sm">{tier.tier}</div>
      {tierImage ? (
        <img 
          src={tierImage} 
          alt={`${tier.tier} rank`}
          className="w-full h-full object-contain"
        />
      ) : (
        <div 
          className="w-full h-full rounded-full flex items-center justify-center font-bold"
          style={{ 
            background: tier.gradient,
            color: tier.textColor
          }}
        >
          <div className="text-center text-sm">{tier.tier}</div>
        </div>
      )}
    </div>
  );
}