// frontend/src/hooks/useApi.ts
import { useEffect, useState } from "react";

// Determine API base URL: always use localhost:3000 for the Express backend
// In development (localhost:5173) or production (file://), backend is always on port 3000
const API_BASE_URL = window.location.protocol === 'file:' || window.location.port === '5173'
    ? 'http://localhost:3000' 
    : '';

// In-memory cache for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry<unknown>>();

export async function jget<T>(url: string): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const r = await fetch(fullUrl);
    if (!r.ok) throw new Error(`${r.status} ${fullUrl}`);
    return r.json();
}

export async function jpost<T>(url: string, body?: unknown): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const r = await fetch(fullUrl, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error(`${r.status} ${fullUrl}`);
    return r.json();
}

// Helper to get full URL for fetch (for components that use fetch directly)
export function getApiUrl(url: string): string {
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

export interface UseQueryOptions {
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  staleTime?: number; // Time in ms before data is considered stale (default: 0)
  cacheTime?: number; // Time in ms to keep unused data in cache (default: 5 minutes)
}

export function useQuery<T>(key: string, url: string, options?: UseQueryOptions) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refetchCount, setRefetchCount] = useState(0);
    
    const staleTime = options?.staleTime ?? 0; // Default: always stale
    const cacheTime = options?.cacheTime ?? 5 * 60 * 1000; // Default: 5 minutes

    useEffect(() => {
        let alive = true;
        let intervalId: number | null = null;

        const fetchData = async () => {
            // Check cache first
            const cached = queryCache.get(key) as CacheEntry<T> | undefined;
            const now = Date.now();
            
            if (cached && (now - cached.timestamp) < staleTime) {
                // Cache is fresh, use it
                if (alive) {
                    setData(cached.data);
                    setLoading(false);
                }
                return;
            }
            
            // Cache is stale or doesn't exist, fetch fresh data
            // Don't set loading to true on refetch, only on initial load
            if (!data && !cached) setLoading(true);
            setError(null);
            
            try {
                const freshData = await jget<T>(url);
                if (alive) {
                    setData(freshData);
                    // Update cache
                    queryCache.set(key, {
                        data: freshData,
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                if (alive) setError(e as Error);
            } finally {
                if (alive) setLoading(false);
            }
        };

        // Initial fetch
        fetchData();

        // Set up auto-refetch if interval is specified
        if (options?.refetchInterval && options.refetchInterval > 0) {
            intervalId = setInterval(fetchData, options.refetchInterval) as unknown as number;
        }

        // Listen for real-time update events
        const handleUpdate = () => fetchData();
        window.addEventListener('data-updated', handleUpdate);

        return () => { 
            alive = false;
            if (intervalId) clearInterval(intervalId);
            window.removeEventListener('data-updated', handleUpdate);
            
            // Schedule cache cleanup after cacheTime
            setTimeout(() => {
                const cached = queryCache.get(key);
                if (cached && (Date.now() - cached.timestamp) > cacheTime) {
                    queryCache.delete(key);
                }
            }, cacheTime);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, url, options?.refetchInterval, refetchCount, staleTime, cacheTime]);

    const refetch = () => {
        setRefetchCount(prev => prev + 1);
    };

    return { data, loading, error, refetch };
}
