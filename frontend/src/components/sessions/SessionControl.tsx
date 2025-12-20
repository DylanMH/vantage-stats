import { useState, useEffect } from "react";
import { useSession } from "../../hooks/useSession";

type SessionControlProps = {
  onSessionEnd?: () => void;
};

export default function SessionControl({ onSessionEnd }: SessionControlProps) {
  const { activeSession, isLoading: contextLoading, startSession, endSession } = useSession();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update elapsed time every second for active session
  useEffect(() => {
    if (!activeSession) return;

    const updateElapsed = () => {
      const started = new Date(activeSession.started_at);
      const now = new Date();
      const diff = Math.floor((now.getTime() - started.getTime()) / 1000);
      setElapsedTime(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      await startSession(sessionName || undefined);
      setSessionName('');
      setShowNamePrompt(false);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    setIsLoading(true);
    try {
      await endSession();
      
      if (onSessionEnd) {
        onSessionEnd();
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Current Session</h2>
          {activeSession ? (
            <div className="space-y-1">
              <p className="text-theme-muted text-sm">
                Session started {new Date(activeSession.started_at).toLocaleTimeString()}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 font-medium">Active</span>
                </div>
                <span className="text-white font-mono text-lg">
                  {formatElapsedTime(elapsedTime)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-theme-muted">No active session</p>
          )}
        </div>

        <div>
          {activeSession ? (
            <button
              onClick={handleEndSession}
              disabled={isLoading || contextLoading}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Ending...' : 'End Session'}
            </button>
          ) : (
            <button
              onClick={() => setShowNamePrompt(true)}
              disabled={isLoading || contextLoading}
              className="px-6 py-3 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 text-white rounded-lg font-medium transition-colors"
            >
              Start Session
            </button>
          )}
        </div>
      </div>

      {/* Session Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Start New Session</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Session Name (optional)
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Morning Practice, Flick Training..."
                className="w-full px-4 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white placeholder-theme-muted focus:border-theme-accent focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartSession();
                  if (e.key === 'Escape') {
                    setShowNamePrompt(false);
                    setSessionName('');
                  }
                }}
              />
              <p className="text-xs text-theme-muted mt-1">
                Give your session a name to easily identify it later
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNamePrompt(false);
                  setSessionName('');
                }}
                className="px-4 py-2 bg-theme-tertiary hover:bg-theme-primary text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartSession}
                disabled={isLoading || contextLoading}
                className="px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
