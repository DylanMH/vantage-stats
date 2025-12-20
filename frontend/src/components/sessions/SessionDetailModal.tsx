import { useState, useEffect } from "react";
import type { Session } from "../../types/sessions";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Run = {
  id: number;
  task_name: string;
  score: number | null;
  accuracy: number | null;
  avg_ttk: number | null;
  duration: number | null;
  played_at: string;
};

type SessionWithRuns = Session & {
  runs: Run[];
};

type TaskBreakdown = {
  task_name: string;
  count: number;
  avg_score: number;
  avg_accuracy: number;
  avg_ttk: number;
  best_run: Run;
};

type SessionDetailModalProps = {
  sessionId: number;
  onClose: () => void;
  onUpdate: () => void;
};

export default function SessionDetailModal({ sessionId, onClose, onUpdate }: SessionDetailModalProps) {
  const [session, setSession] = useState<SessionWithRuns | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch session details
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        const data = await response.json();
        setSession(data);
        setNewName(data.name || '');
        setNewNotes(data.notes || '');
      } catch (error) {
        console.error('Error fetching session:', error);
        alert('Failed to load session details');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId, onClose]);

  const handleUpdateName = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || null })
      });
      if (!response.ok) throw new Error('Failed to update name');
      const updated = await response.json();
      setSession({ ...session, name: updated.name });
      setEditingName(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Failed to update session name');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNotes = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes || null })
      });
      if (!response.ok) throw new Error('Failed to update notes');
      const updated = await response.json();
      setSession({ ...session, notes: updated.notes });
      setEditingNotes(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('Failed to update session notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete session');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const calculateTaskBreakdown = (): TaskBreakdown[] => {
    if (!session || !session.runs || session.runs.length === 0) return [];

    const taskMap = new Map<string, Run[]>();
    
    session.runs.forEach(run => {
      const existing = taskMap.get(run.task_name) || [];
      existing.push(run);
      taskMap.set(run.task_name, existing);
    });

    const breakdown: TaskBreakdown[] = [];

    taskMap.forEach((runs, task_name) => {
      const validScores = runs.filter(r => r.score !== null);
      const validAccuracy = runs.filter(r => r.accuracy !== null);
      const validTtk = runs.filter(r => r.avg_ttk !== null);

      const avg_score = validScores.length > 0 
        ? validScores.reduce((sum, r) => sum + r.score!, 0) / validScores.length 
        : 0;
      
      const avg_accuracy = validAccuracy.length > 0
        ? validAccuracy.reduce((sum, r) => sum + r.accuracy!, 0) / validAccuracy.length
        : 0;
      
      const avg_ttk = validTtk.length > 0
        ? validTtk.reduce((sum, r) => sum + r.avg_ttk!, 0) / validTtk.length
        : 0;

      const best_run = runs.reduce((best, current) => {
        if (!best.score) return current;
        if (!current.score) return best;
        return current.score > best.score ? current : best;
      }, runs[0]);

      breakdown.push({
        task_name,
        count: runs.length,
        avg_score,
        avg_accuracy,
        avg_ttk,
        best_run
      });
    });

    return breakdown.sort((a, b) => b.count - a.count);
  };

  const taskBreakdown = calculateTaskBreakdown();

  if (loading || !session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-8">
          <div className="w-8 h-8 border-4 border-theme-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-secondary border-b border-theme-primary p-6 flex items-center justify-between">
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Session name..."
                  className="flex-1 px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded text-white focus:border-theme-accent focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleUpdateName}
                  disabled={saving}
                  className="px-3 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded text-sm disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNewName(session.name || '');
                  }}
                  className="px-3 py-2 bg-theme-tertiary hover:bg-theme-primary text-white rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">
                  {session.name || `Session ${session.id}`}
                </h2>
                {session.is_practice === 1 && (
                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 text-purple-300 text-sm font-medium rounded">
                    🎯 Practice Session
                  </span>
                )}
                <button
                  onClick={() => {
                    setNewName(session.name || '');
                    setEditingName(true);
                  }}
                  className="text-theme-muted hover:text-white text-sm"
                >
                  Edit
                </button>
              </div>
            )}
            <p className="text-sm text-theme-muted mt-1">
              {new Date(session.started_at).toLocaleString()} - {session.ended_at ? new Date(session.ended_at).toLocaleString() : 'Active'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-theme-muted hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
              <p className="text-sm text-theme-muted mb-1">Total Runs</p>
              <p className="text-2xl font-bold text-blue-400">{session.total_runs}</p>
            </div>
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
              <p className="text-sm text-theme-muted mb-1">Play Time</p>
              <p className="text-2xl font-bold text-green-400">{formatDuration(session.total_duration)}</p>
            </div>
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
              <p className="text-sm text-theme-muted mb-1">Duration</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatDuration(
                  Math.floor(
                    (new Date(session.ended_at || session.started_at).getTime() - 
                     new Date(session.started_at).getTime()) / 1000
                  )
                )}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">Notes</h3>
              {!editingNotes && (
                <button
                  onClick={() => {
                    setNewNotes(session.notes || '');
                    setEditingNotes(true);
                  }}
                  className="text-theme-muted hover:text-white text-sm"
                >
                  {session.notes ? 'Edit' : 'Add notes'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Add notes about this session..."
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded text-white focus:border-theme-accent focus:outline-none min-h-[100px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateNotes}
                    disabled={saving}
                    className="px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNewNotes(session.notes || '');
                    }}
                    className="px-4 py-2 bg-theme-tertiary hover:bg-theme-primary text-white rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-theme-muted">
                {session.notes || 'No notes for this session.'}
              </p>
            )}
          </div>

          {/* Task Breakdown Analysis */}
          {taskBreakdown.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Task Breakdown</h3>
              <div className="space-y-3">
                {taskBreakdown.map((task) => (
                  <div key={task.task_name} className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white text-lg">{task.task_name}</h4>
                      <span className="text-sm text-theme-muted">{task.count} run{task.count > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-theme-secondary rounded-lg p-3">
                        <p className="text-xs text-theme-muted mb-1">Avg Score</p>
                        <p className="text-xl font-bold text-blue-400">
                          {task.avg_score > 0 ? Math.round(task.avg_score).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="bg-theme-secondary rounded-lg p-3">
                        <p className="text-xs text-theme-muted mb-1">Avg Accuracy</p>
                        <p className="text-xl font-bold text-green-400">
                          {task.avg_accuracy > 0 ? `${task.avg_accuracy.toFixed(1)}%` : '—'}
                        </p>
                      </div>
                      <div className="bg-theme-secondary rounded-lg p-3">
                        <p className="text-xs text-theme-muted mb-1">Avg TTK</p>
                        <p className="text-xl font-bold text-orange-400">
                          {task.avg_ttk > 0 ? `${task.avg_ttk.toFixed(3)}s` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-green-300 uppercase">Best Run</p>
                        <span className="text-xs text-theme-muted">
                          {new Date(task.best_run.played_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-theme-muted block text-xs">Score</span>
                          <span className="text-blue-400 font-bold">
                            {task.best_run.score !== null ? task.best_run.score.toLocaleString() : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-theme-muted block text-xs">Accuracy</span>
                          <span className="text-green-400 font-bold">
                            {task.best_run.accuracy !== null ? `${task.best_run.accuracy.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-theme-muted block text-xs">TTK</span>
                          <span className="text-orange-400 font-bold">
                            {task.best_run.avg_ttk !== null ? `${task.best_run.avg_ttk.toFixed(3)}s` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Runs List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">All Runs ({session.runs.length})</h3>
            {session.runs.length > 0 ? (
              <div className="space-y-2">
                {session.runs.map((run) => (
                  <div key={run.id} className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-white">{run.task_name}</h4>
                      <span className="text-xs text-theme-muted">
                        {new Date(run.played_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-theme-muted block">Score</span>
                        <span className="text-blue-400 font-medium">
                          {run.score !== null ? run.score.toLocaleString() : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Accuracy</span>
                        <span className="text-green-400 font-medium">
                          {run.accuracy !== null ? `${run.accuracy.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Avg TTK</span>
                        <span className="text-orange-400 font-medium">
                          {run.avg_ttk !== null ? `${run.avg_ttk.toFixed(3)}s` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Duration</span>
                        <span className="text-purple-400 font-medium">
                          {run.duration !== null ? `${Math.floor(run.duration / 60)}m ${Math.floor(run.duration % 60)}s` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-theme-muted py-8">No runs in this session.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
