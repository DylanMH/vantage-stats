import type { Tier } from "../../types/ranked";

export function RankBadge({ tier, size = 'medium' }: { tier: Tier; size?: 'small' | 'medium' | 'large' }) {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };
  
  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold transition-all duration-300`}
      style={{ 
        background: tier.gradient,
        color: tier.textColor,
        boxShadow: `0 4px 20px ${tier.color}40`
      }}
    >
      <div className="text-center">
        <div className={textSizeClasses[size]}>{tier.tier}</div>
      </div>
    </div>
  );
}
