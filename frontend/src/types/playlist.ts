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
