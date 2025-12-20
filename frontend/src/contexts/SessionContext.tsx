import { createContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '../types/sessions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type SessionContextType = {
  activeSession: Session | null;
  isLoading: boolean;
  startSession: (name?: string) => Promise<void>;
  endSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActiveSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/sessions?active=true`);
      if (response.ok) {
        const sessions = await response.json();
        setActiveSession(sessions.length > 0 ? sessions[0] : null);
      }
    } catch (error) {
      console.error('Failed to fetch active session:', error);
    }
  }, []);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  const startSession = async (name?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || null })
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const newSession = await response.json();
      setActiveSession(newSession);
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions/${activeSession.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      setActiveSession(null);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    await fetchActiveSession();
  };

  return (
    <SessionContext.Provider value={{ activeSession, isLoading, startSession, endSession, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export { SessionContext };
