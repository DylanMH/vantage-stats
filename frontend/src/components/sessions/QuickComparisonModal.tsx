import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '../../hooks/useApi';
import type { Session, ComparisonResult } from '../../types/sessions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type QuickComparisonModalProps = {
  initialSessionId: number;
  onClose: () => void;
  onComplete: (result: ComparisonResult) => void;
};

export default function QuickComparisonModal({ initialSessionId, onClose, onComplete }: QuickComparisonModalProps) {
  const { data: sessions } = useQuery<Session[]>('sessions', '/api/sessions');
  const [leftSessionId, setLeftSessionId] = useState<number>(initialSessionId);
  const [rightSessionId, setRightSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const completedSessions = useMemo(() => 
    sessions?.filter(s => s.is_active === 0) || [], 
    [sessions]
  );

  useEffect(() => {
    if (completedSessions.length > 0 && rightSessionId === null) {
      // Find the index of the initial session
      const initialIndex = completedSessions.findIndex(s => s.id === initialSessionId);
      
      if (initialIndex === -1) {
        // Initial session not found, pick first available
        setRightSessionId(completedSessions[0].id);
      } else if (initialIndex < completedSessions.length - 1) {
        // Not the last session, pick the one below (next in list)
        setRightSessionId(completedSessions[initialIndex + 1].id);
      } else if (initialIndex > 0) {
        // Last session, pick the one above (previous in list)
        setRightSessionId(completedSessions[initialIndex - 1].id);
      } else if (completedSessions.length > 1) {
        // Only one session and it's the initial, pick the second one
        setRightSessionId(completedSessions[1].id);
      }
    }
  }, [completedSessions, rightSessionId, initialSessionId]);

  const handleSwap = () => {
    const temp = leftSessionId;
    setLeftSessionId(rightSessionId!);
    setRightSessionId(temp);
  };

  const handleCompare = async () => {
    if (!rightSessionId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/comparisons/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left: { type: 'session', sessionId: leftSessionId },
          right: { type: 'session', sessionId: rightSessionId },
          taskScope: 'all'
        })
      });

      if (!response.ok) throw new Error('Failed to run comparison');

      const result = await response.json();
      onComplete(result);
      onClose();
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (completedSessions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Compare Session</h2>
            <button
              onClick={onClose}
              className="px-2 py-1 hover:bg-theme-primary rounded transition-colors text-white text-xl"
            >
              ✕
            </button>
          </div>
          <p className="text-theme-muted text-center py-8">
            No other sessions available to compare with.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-8 max-w-5xl w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-white">Compare Session</h2>
          <button
            onClick={onClose}
            className="px-2 py-1 hover:bg-theme-primary rounded transition-colors text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-1 h-12 bg-blue-400 rounded flex-shrink-0" />
            
            <select
              value={leftSessionId}
              onChange={(e) => {
                const newLeft = parseInt(e.target.value);
                setLeftSessionId(newLeft);
                // If right side is now the same, pick a different one
                if (newLeft === rightSessionId) {
                  const otherSession = completedSessions.find(s => s.id !== newLeft);
                  if (otherSession) setRightSessionId(otherSession.id);
                }
              }}
              className="flex-1 min-w-0 px-4 py-3 bg-theme-tertiary border-2 border-blue-400/50 rounded text-white focus:border-blue-400 focus:outline-none h-[48px]"
            >
              {completedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleSwap}
              disabled={!rightSessionId}
              className="px-4 py-3 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary rounded text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xl flex-shrink-0"
              title="Swap sessions"
            >
              ⇄
            </button>
            
            <span className="text-theme-muted font-bold text-xl px-2 flex-shrink-0">vs</span>
            
            <select
              value={rightSessionId || ''}
              onChange={(e) => {
                const newRight = parseInt(e.target.value);
                setRightSessionId(newRight);
                // If left side is now the same, pick a different one
                if (newRight === leftSessionId) {
                  const otherSession = completedSessions.find(s => s.id !== newRight);
                  if (otherSession) setLeftSessionId(otherSession.id);
                }
              }}
              className="flex-1 min-w-0 px-4 py-3 bg-theme-tertiary border-2 border-green-400/50 rounded text-white focus:border-green-400 focus:outline-none h-[48px]"
            >
              {completedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            
            <div className="w-1 h-12 bg-green-400 rounded flex-shrink-0" />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-theme-primary mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary rounded text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCompare}
              disabled={loading || !rightSessionId || leftSessionId === rightSessionId}
              className="px-8 py-2.5 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
            >
              {loading ? 'Comparing...' : 'Compare Sessions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
