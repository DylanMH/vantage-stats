export type Tier = {
  tier: string;
  color: string;
  gradient: string;
  textColor: string;
  minPoints: number;
  maxPoints: number;
};

export type ProgressData = {
  xp: number;
  xpMax: number;
  overflowMax: number;
  xpGainLastRun: number;
  progressPoints: number;
  progressTierDisplay: string;
  isOverflow: boolean;
};

export type CategoryStats = {
  rating: number | null;
  percentile: number | null;
  points: number | null;
  distinctTasks: number;
  totalRuns: number;
  isProvisional: boolean;
  tier: Tier;
  progress?: ProgressData;
};

export type RankedStats = {
  overall: {
    rating: number | null;
    percentile: number | null;
    points: number | null;
    isProvisional: boolean;
    tier: Tier;
  };
  categories: {
    Flicking: CategoryStats;
    Tracking: CategoryStats;
    "Target Switching": CategoryStats;
  };
};

export type RecentRun = {
  id: number;
  taskName: string;
  score: number;
  playedAt: string;
  percentile: number | null;
  points: number | null;
  tier: Tier | null;
  leaderboardId: number | null;
  xpGain?: number;
};

export type RankTierInfo = {
  tier: string;
  color: string;
  gradient: string;
  textColor: string;
  minPoints: number;
  maxPoints: number;
  percentileRange: string;
};

export type RankedTask = {
  leaderboardId: number;
  scenarioName: string;
  category: string;
  entries: number;
  plays: number;
  userPlays: number;
  bestScore: number | null;
  bestPercentile: number | null;
  bestTier: Tier | null;
};

export type RankedTasksResponse = {
  Flicking?: {
    tasks: RankedTask[];
  };
  Tracking?: {
    tasks: RankedTask[];
  };
  "Target Switching"?: {
    tasks: RankedTask[];
  };
};
