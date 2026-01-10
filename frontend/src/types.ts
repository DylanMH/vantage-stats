export type Run = {
    id?: number;
    task_id?: number;
    task_name?: string;
    filename?: string;
    path?: string;
    played_at: string;
    score?: number | null;
    hits?: number | null;
    shots?: number | null;
    accuracy?: number | null; // percent 0–100 (parser normalizes)
    avg_ttk?: number | null;
    overshots?: number | null;
    reloads?: number | null;
    fps_avg?: number | null;
    duration?: number | null;
    score_per_min?: number | null;
    meta?: string | null;
};

export type TaskAgg = {
    task_name: string;
    runs: number;
    avg_accuracy: number | null;
    avg_score: number | null;
    last_played: string | null;
};

export type Summary = {
    total_runs: number;
    tasks_played: number;
    avg_accuracy: number | null;
};

export type RawTask = {
    task_name?: string; 
    task?: string; 
    filename?: string;
    runs?: number;
    avg_accuracy?: number | null;
    avg_score?: number | null;
    avg_shots?: number | null;
    avg_hits?: number | null;
    avg_ttk?: number | null;
    avg_duration?: number | null;
    avg_overshots?: number | null;
    max_score?: number | null;
    last_played?: string | null;
};

// User and Profile types
export type UserProfile = {
    username: string;
    total_runs: number;
    total_playtime: number; // seconds
    unique_tasks?: number;
};

// Goal types
export type Goal = {
    id: number;
    title: string;
    description: string;
    goal_type: string;
    current_value: number;
    target_value: number;
    is_completed: boolean;
    completed_at?: string;
    created_at: string;
    target_task_name?: string;
    target_pack_id?: number;
    target_playlist_name?: string;
    target_timeframe?: number;
    target_date?: string;
    is_user_created?: boolean;
};

export type TabType = "overall" | "task" | "playlist";

// Toast and UI types
export type ToastMessage = {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
};

// Run row types for tables
export type RunRow = {
    id: number;
    task: string;
    accuracy: number | null;
    score: number | null;
    shots: number | null;
    hits: number | null;
    avg_ttk: number | null;
    duration: number | null;
    played_at: string;
};

export type DayRun = {
    id: number;
    task_name: string;
    score: number | null;
    accuracy: number | null;
    avg_ttk: number | null;
    shots: number | null;
    hits: number | null;
    duration: number | null;
    played_at: string;
};

// Playlist types
export type Playlist = {
    id: number;
    name: string;
    description?: string;
    game_focus?: string;
    task_count?: number;
    created_at?: string;
};

export type PlaylistStats = {
    avg_accuracy: number;
    avg_score: number;
    avg_ttk: number;
    total_runs: number;
    tasks_played: number;
};

export type PlaylistWithTasks = Playlist & {
    tasks: Array<{
        id: number;
        name: string;
    }>;
};

// Ranked system types
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
    img: string;
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

// Session and comparison types
export type Session = {
    id: number;
    name: string | null;
    notes: string | null;
    started_at: string;
    ended_at: string | null;
    is_active: number; // 0 or 1 (SQLite boolean)
    is_practice: number; // 0 or 1
    total_runs: number;
    total_duration: number;
    created_at: string;
};

export type WindowDefinition = 
    | { type: 'session'; sessionId: number }
    | { type: 'timeframe'; startTime: string; endTime: string }
    | { type: 'relative'; hours: number; hoursAgo?: number }
    | string; // Preset shortcuts like 'today', 'yesterday'

export type TaskScope = 'all' | 'shared' | 'specific';

export type ComparisonConfig = {
    left: WindowDefinition;
    right: WindowDefinition;
    taskScope: TaskScope;
    taskIds?: number[];
};

export type AggregatedStats = {
    count: number;
    avg_score: number | null;
    avg_accuracy: number | null;
    avg_ttk: number | null;
    total_duration: number | null;
    unique_tasks: number;
    score_p50: number | null;
    score_p95: number | null;
    accuracy_p50: number | null;
    accuracy_p95: number | null;
    ttk_p50: number | null;
    ttk_p95: number | null;
};

export type TaskStats = {
    task_id: number;
    task_name: string;
    count: number;
    avg_score: number | null;
    avg_accuracy: number | null;
    avg_ttk: number | null;
    max_score: number | null;
    min_score: number | null;
};

export type TrendPoint = {
    bucket: string;
    avg_score: number | null;
    avg_accuracy: number | null;
    avg_ttk: number | null;
    count: number;
};

export type ComparisonDiffs = {
    score: number;
    scorePct: number | null;
    accuracy: number;
    accuracyPct: number | null;
    ttk: number;
    ttkPct: number | null;
};

export type TaskComparison = {
    taskId: number;
    taskName: string;
    left: {
        count: number;
        avgScore: number | null;
        avgAccuracy: number | null;
        avgTtk: number | null;
    };
    right: {
        count: number;
        avgScore: number | null;
        avgAccuracy: number | null;
        avgTtk: number | null;
    };
    diff: ComparisonDiffs;
};

export type ComparisonResult = {
    overall: {
        left: AggregatedStats;
        right: AggregatedStats;
        diffs: ComparisonDiffs;
    };
    tasks: TaskComparison[];
    trend: {
        left: TrendPoint[];
        right: TrendPoint[];
    };
    meta: {
        hasSharedTasks: boolean;
        sharedTaskCount: number;
        leftRunCount: number;
        rightRunCount: number;
        leftTaskCount: number;
        rightTaskCount: number;
        leftSessionId?: number;
        rightSessionId?: number;
    };
    labels?: {
        left: string;
        right: string;
    };
};

export type SavedComparison = {
    id: number;
    name: string;
    description: string | null;
    left_type: string;
    left_value: string;
    right_type: string;
    right_value: string;
    task_scope: string;
    created_at: string;
    last_used_at: string | null;
};
