import { useEffect } from 'react';
import { getApiUrl } from './useApi';

/**
 * Hook to listen for real-time updates from the server
 * Triggers a callback when new data is available
 */
export function useRealtimeUpdates(onUpdate: () => void) {
  useEffect(() => {
    const eventSource = new EventSource(getApiUrl('/api/events'));

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new-run') {
          console.log('📊 Real-time update: New run detected, refreshing data...');
          onUpdate();
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // EventSource will automatically reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [onUpdate]);
}
