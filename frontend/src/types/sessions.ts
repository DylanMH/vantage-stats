// frontend/src/types/sessions.ts
// Type definitions for sessions and comparisons

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
