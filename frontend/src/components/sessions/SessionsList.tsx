import { useState } from "react";
import { useQuery } from "../../hooks/useApi";
import type { Session } from "../../types/sessions";
import SessionDetailModal from "./SessionDetailModal";

type SessionsListProps = {
  onCompare: (sessionId: number) => void;
};

export default function SessionsList({ onCompare }: SessionsListProps) {
  const { data: sessions, loading, refetch } = useQuery<Session[]>('sessions', '/api/sessions');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfSessionDay = new Date(date);
    startOfSessionDay.setHours(0, 0, 0, 0);

    const diffDays = Math.round((startOfToday.getTime() - startOfSessionDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today at ${date.toLocaleTimeString()}`;
    if (diffDays === 1) return `Yesterday at ${date.toLocaleTimeString()}`;
    return date.toLocaleString();
  };

  // Only show completed sessions (not active)
  const completedSessions = sessions?.filter(s => !s.is_active) || [];

  if (loading) {
    return (
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Sessions</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-theme-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (completedSessions.length === 0) {
    return (
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Sessions</h2>
        <div className="text-center py-8 text-theme-muted">
          <p>No completed sessions yet.</p>
          <p className="text-sm mt-2">Start and end a session to track it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Recent Sessions</h2>
      
      <div className="space-y-3">
        {completedSessions.slice(0, 10).map((session) => (
          <div
            key={session.id}
            className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4 hover:border-theme-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-white font-semibold truncate">
                    {session.name || `Session ${session.id}`}
                  </h3>
                  <span className="text-xs text-theme-muted whitespace-nowrap">
                    {formatDate(session.started_at)}
                  </span>
                </div>
                
                {session.notes && (
                  <p className="text-sm text-theme-muted mb-2 line-clamp-2">
                    {session.notes}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-theme-muted">Runs:</span>
                    <span className="text-blue-400 font-medium">{session.total_runs}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-theme-muted">Play Time:</span>
                    <span className="text-green-400 font-medium">
                      {formatDuration(session.total_duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-theme-muted">Duration:</span>
                    <span className="text-purple-400 font-medium">
                      {formatDuration(
                        Math.floor(
                          (new Date(session.ended_at || session.started_at).getTime() - 
                           new Date(session.started_at).getTime()) / 1000
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSessionId(session.id)}
                  className="px-3 py-2 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary text-white rounded-lg font-medium transition-colors whitespace-nowrap text-sm"
                  title="View details"
                >
                  View
                </button>
                <button
                  onClick={() => onCompare(session.id)}
                  className="px-3 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded-lg font-medium transition-colors whitespace-nowrap text-sm"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Session Detail Modal */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          onUpdate={() => {
            refetch();
            setSelectedSessionId(null);
          }}
        />
      )}
    </div>
  );
}
