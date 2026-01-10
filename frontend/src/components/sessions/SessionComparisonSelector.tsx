import { useState, useEffect, useMemo } from 'react';
import type { Session, ComparisonResult } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface SessionComparisonSelectorProps {
  sessions: Session[];
  onComparisonComplete: (result: ComparisonResult) => void;
};

export default function SessionComparisonSelector({ sessions, onComparisonComplete }: SessionComparisonSelectorProps) {
  const [leftSessionId, setLeftSessionId] = useState<number | null>(null);
  const [rightSessionId, setRightSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const completedSessions = useMemo(() => sessions?.filter(s => s.is_active === 0) || [], [sessions]);

  useEffect(() => {
    if (completedSessions.length >= 2 && leftSessionId === null && rightSessionId === null) {
      setLeftSessionId(completedSessions[0].id);
      setRightSessionId(completedSessions[1].id);
    }
  }, [completedSessions, leftSessionId, rightSessionId]);

  const handleSwap = () => {
    const temp = leftSessionId;
    setLeftSessionId(rightSessionId);
    setRightSessionId(temp);
  };

  const handleCompare = async () => {
    if (!leftSessionId || !rightSessionId) return;

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
      onComparisonComplete(result);
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (completedSessions.length < 2) {
    return null;
  }

  return (
    <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Session Comparison</h2>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-1 h-10 bg-blue-400 rounded" />
          <select
            value={leftSessionId || ''}
            onChange={(e) => setLeftSessionId(parseInt(e.target.value))}
            className="flex-1 px-4 py-2.5 bg-theme-tertiary border-2 border-blue-400/50 rounded text-white text-sm focus:border-blue-400 focus:outline-none"
          >
            {completedSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleSwap}
          className="px-3 py-2 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary rounded text-white transition-colors text-lg"
          title="Swap sessions"
        >
          ⇄
        </button>
        
        <span className="text-theme-muted font-bold text-lg px-2">vs</span>
        
        <div className="flex items-center gap-3 flex-1">
          <select
            value={rightSessionId || ''}
            onChange={(e) => setRightSessionId(parseInt(e.target.value))}
            className="flex-1 px-4 py-2.5 bg-theme-tertiary border-2 border-green-400/50 rounded text-white text-sm focus:border-green-400 focus:outline-none"
          >
            {completedSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
              </option>
            ))}
          </select>
          <div className="w-1 h-10 bg-green-400 rounded" />
        </div>
        
        <button
          onClick={handleCompare}
          disabled={loading || !leftSessionId || !rightSessionId || leftSessionId === rightSessionId}
          className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors whitespace-nowrap"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {leftSessionId === rightSessionId && (
        <p className="text-orange-400 text-sm mt-3">Please select two different sessions to compare</p>
      )}
    </div>
  );
}
