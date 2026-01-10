// frontend/hooks/useRealTimeUpdates.ts
// Enhanced real-time updates using Server-Sent Events

import { useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from './useApi';

interface RealTimeEvent {
  type: 'new-run' | 'stats-updated';
  data?: unknown;
  timestamp: number;
}

interface UseRealTimeUpdatesOptions {
  onNewRun?: () => void;
  onStatsUpdated?: (data?: unknown) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Enhanced hook to listen for real-time updates from the server
 * Triggers callbacks when new data is available with better error handling
 */
export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new EventSource connection
      eventSourceRef.current = new EventSource(getApiUrl('/api/events'));

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealTimeEvent;
          
          switch (data.type) {
            case 'new-run':
              console.log('📊 Real-time update: New run detected, refreshing data...');
              options.onNewRun?.();
              break;
            case 'stats-updated':
              console.log('🔄 Real-time update: Stats cache updated');
              options.onStatsUpdated?.(data.data);
              break;
            default:
              console.log('📡 Unknown real-time event:', data.type);
          }
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('SSE connection error:', error);
        options.onError?.(error);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const backoffTime = Math.pow(2, reconnectAttemptsRef.current) * 1000;
          reconnectAttemptsRef.current++;
          
          console.log(`🔄 Reconnecting in ${backoffTime}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffTime);
        } else {
          console.error('❌ Max reconnection attempts reached. Manual refresh required.');
          options.onDisconnect?.();
        }
      };

      eventSourceRef.current.onopen = () => {
        console.log('✅ Real-time updates connected');
        reconnectAttemptsRef.current = 0;
        options.onConnect?.();
        
        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      options.onError?.(error as Event);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.onNewRun, options.onStatsUpdated, options.onError, options.onConnect, options.onDisconnect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    options.onDisconnect?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.onDisconnect]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected: !!eventSourceRef.current,
    disconnect,
    reconnect: connect
  };
}
