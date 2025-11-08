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
