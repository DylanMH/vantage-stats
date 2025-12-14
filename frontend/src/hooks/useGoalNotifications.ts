import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from './useApi';

type Goal = {
  id: number;
  goal_type: string;
  target_value: number;
  current_value: number;
  description: string;
  target_task_name?: string;
  completed_at?: string;
};

export function useGoalNotifications() {
  const [notifications, setNotifications] = useState<Goal[]>([]);
  const lastCheckRef = useRef<string | null>(null);
  const shownGoalsRef = useRef<Set<string>>(new Set()); // Track by "id-timestamp" for re-triggering
  const storageKeyLastCheck = 'goalAchievementsLastCheck';

  const checkAchievements = useCallback(async () => {
    try {
      // Build URL with optional since parameter
      const params = new URLSearchParams();
      if (lastCheckRef.current) {
        params.append('since', lastCheckRef.current);
      }
      
      const url = getApiUrl(`/api/goals/check-achievements${params.toString() ? `?${params.toString()}` : ''}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        // Silently fail if endpoint not available (e.g., server not restarted)
        if (response.status === 404) return;
        console.warn('Goal achievements check failed:', response.status);
        return;
      }
      
      const data = await response.json();
      const achievements = data.achievements || [];
      
      // Filter out goals we've already shown (by id + timestamp combo)
      const newAchievements = achievements.filter((goal: Goal) => {
        const key = `${goal.id}-${goal.completed_at}`;
        return !shownGoalsRef.current.has(key);
      });
      
      if (newAchievements.length > 0) {
        // Add to notification queue
        setNotifications(prev => [...prev, ...newAchievements]);
        
        // Mark as shown (by id + timestamp)
        newAchievements.forEach((goal: Goal) => {
          const key = `${goal.id}-${goal.completed_at}`;
          shownGoalsRef.current.add(key);
        });
      }
      
      // Update last check time (persist across restarts)
      // Use max completed_at if present to avoid missing rapid successive completions.
      const newestCompletedAt = achievements
        .map((g: Goal) => g.completed_at)
        .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
        .sort()
        .at(-1);

      const nextLastCheck = newestCompletedAt || new Date().toISOString();
      lastCheckRef.current = nextLastCheck;
      try {
        localStorage.setItem(storageKeyLastCheck, nextLastCheck);
      } catch {
        // ignore storage failures
      }
      
    } catch (error) {
      console.error('Failed to check goal achievements:', error);
    }
  }, []);

  // Check for achievements every 10 seconds
  useEffect(() => {
    // Initialize lastCheckRef once per app install/run.
    // If we don't have a stored timestamp, set it to now so old completions don't re-notify on every startup.
    try {
      const stored = localStorage.getItem(storageKeyLastCheck);
      lastCheckRef.current = stored || new Date().toISOString();
      if (!stored) {
        localStorage.setItem(storageKeyLastCheck, lastCheckRef.current);
      }
    } catch {
      lastCheckRef.current = new Date().toISOString();
    }

    // Initial check
    checkAchievements();
    
    // Set up interval
    const interval = setInterval(checkAchievements, 10000);
    
    return () => clearInterval(interval);
  }, [checkAchievements]);

  const dismissNotification = useCallback((goalId: number) => {
    setNotifications(prev => prev.filter(g => g.id !== goalId));
  }, []);

  return {
    notifications,
    dismissNotification,
    checkAchievements, // Allow manual checking
  };
}
