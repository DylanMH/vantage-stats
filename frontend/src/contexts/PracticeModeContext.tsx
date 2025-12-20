import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type PracticeModeContextType = {
  isPracticeMode: boolean;
  togglePracticeMode: () => Promise<void>;
  isLoading: boolean;
};

const PracticeModeContext = createContext<PracticeModeContextType | undefined>(undefined);

type ErrorModalState = {
  show: boolean;
  message: string;
  sessionName?: string;
};

export function PracticeModeProvider({ children }: { children: ReactNode }) {
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModalState>({ show: false, message: '' });

  useEffect(() => {
    fetchPracticeStatus();
  }, []);

  const fetchPracticeStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/practice/status`);
      if (response.ok) {
        const data = await response.json();
        setIsPracticeMode(data.isPracticeMode);
      }
    } catch (error) {
      console.error('Failed to fetch practice mode status:', error);
    }
  };

  const togglePracticeMode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/practice/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isPracticeMode })
      });

      if (response.ok) {
        const data = await response.json();
        setIsPracticeMode(data.isPracticeMode);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to toggle practice mode';
        
        if (errorData.activeSession) {
          const sessionName = errorData.activeSession.name || `Session ${errorData.activeSession.id}`;
          setErrorModal({
            show: true,
            message: errorMessage,
            sessionName
          });
        } else {
          setErrorModal({
            show: true,
            message: errorMessage
          });
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error toggling practice mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PracticeModeContext.Provider value={{ isPracticeMode, togglePracticeMode, isLoading }}>
      {children}
      
      {/* Error Modal */}
      {errorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-theme-secondary border-2 border-red-500/50 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Cannot Toggle Practice Mode</h3>
                <p className="text-theme-muted text-sm mb-3">
                  {errorModal.message}
                </p>
                {errorModal.sessionName && (
                  <div className="bg-theme-tertiary border border-theme-primary rounded p-3 mb-3">
                    <p className="text-xs text-theme-muted mb-1">Active Session:</p>
                    <p className="text-white font-semibold">"{errorModal.sessionName}"</p>
                  </div>
                )}
                <p className="text-sm text-yellow-400">
                  Please end the active session before changing practice mode.
                </p>
              </div>
            </div>
            <button
              onClick={() => setErrorModal({ show: false, message: '' })}
              className="w-full px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded-lg font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </PracticeModeContext.Provider>
  );
}

export { PracticeModeContext };
