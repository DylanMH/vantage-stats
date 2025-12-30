import { useState } from "react";
import { useQuery } from "../hooks/useApi";
import { Skeleton } from "../components/Skeleton";
import Toast from "../components/Toast";
import type { RankedStats, RankTierInfo, RankedTasksResponse } from "../types/ranked";
import { RankBadge } from "../components/ranked/RankBadge";
import { PointsMeter } from "../components/ranked/PointsMeter";
import { CategoryCard } from "../components/ranked/CategoryCard";
import { AllRankedTasksCard } from "../components/ranked/AllRankedTasksCard";
import { RankLadder } from "../components/ranked/RankLadder";

export default function Ranked() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const { data: rankedStats, loading: loadingStats } = useQuery<RankedStats>(
    "rankedStats", 
    "/api/ranked/stats"
  );
  
  const { data: rankedTasks, loading: loadingTasks } = useQuery<RankedTasksResponse>(
    "rankedTasks",
    "/api/ranked/tasks"
  );
  
  const { data: tiersData } = useQuery<{ tiers: RankTierInfo[] }>(
    "rankTiers",
    "/api/ranked/tiers"
  );
  
  const handleShowToast = (message: string) => {
    setToast({ message, type: 'success' });
  };
  
  if (loadingStats || loadingTasks) {
    return (
      <div className="space-y-6">
        <Skeleton h={200} w={800} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton h={400} w={350} />
          <Skeleton h={400} w={350} />
          <Skeleton h={400} w={350} />
        </div>
      </div>
    );
  }
  
  if (!rankedStats || !rankedTasks) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Unable to load ranked stats
        </p>
      </div>
    );
  }
  
  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Ranked
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Competitive rankings across Flicking, Tracking, and Target Switching
          </p>
        </div>
        
        <div 
          className="rounded-lg p-8 border-2 text-center"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: rankedStats.overall.rating !== null 
              ? rankedStats.overall.tier.color 
              : 'var(--color-border)',
          }}
        >
          <div className="flex flex-col items-center gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Overall Rank
              </h2>
              {rankedStats.overall.isProvisional && (
                <span className="text-sm px-3 py-1 rounded bg-yellow-500/20 text-yellow-400 font-medium">
                  Provisional
                </span>
              )}
            </div>
            
            <RankBadge tier={rankedStats.overall.tier} size="large" />
            
            {rankedStats.overall.rating !== null && rankedStats.overall.points !== null && (
              <div className="w-full max-w-md">
                <PointsMeter 
                  points={rankedStats.overall.points} 
                  tier={rankedStats.overall.tier} 
                />
              </div>
            )}
            
            {rankedStats.overall.rating === null && (
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Complete ranked tasks in all categories to establish your overall rank
              </p>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Categories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CategoryCard
              category="Flicking"
              stats={rankedStats.categories.Flicking}
            />
            <CategoryCard
              category="Tracking"
              stats={rankedStats.categories.Tracking}
            />
            <CategoryCard
              category="Target Switching"
              stats={rankedStats.categories["Target Switching"]}
            />
          </div>
        </div>
        
        <AllRankedTasksCard rankedTasks={rankedTasks} onShowToast={handleShowToast} />
        
        {tiersData?.tiers && (
          <RankLadder tiers={tiersData.tiers} />
        )}
        
        <div 
          className="rounded-lg p-6 border"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            How Ranked Works
          </h3>
          <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Rating Points:</strong>
              {' '}Your performance is converted to rating points (0-3,000). Higher scores earn more points, with ratings calculated from global leaderboard percentiles.
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Category Ratings:</strong>
              {' '}We take the median of your last 30 ranked runs in each category (Flicking, Tracking, Target Switching) to calculate your category rating.
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Overall Rank:</strong>
              {' '}Your overall rank is the average of your three category ratings.
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Requirements:</strong>
              {' '}Ranks become established (non-provisional) after 10+ runs across 3+ distinct tasks per category.
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Practice Mode:</strong>
              {' '}Only runs played when practice mode is OFF count toward your rank. Runs in practice mode are excluded.
            </div>
          </div>
        </div>
      </div>
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
