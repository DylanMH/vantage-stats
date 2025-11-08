// frontend/src/hooks/useApi.ts
import { useEffect, useState } from "react";

// Determine API base URL: always use localhost:3000 for the Express backend
// In development (localhost:5173) or production (file://), backend is always on port 3000
const API_BASE_URL = window.location.protocol === 'file:' || window.location.port === '5173'
    ? 'http://localhost:3000' 
    : '';

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

export function useQuery<T>(key: string, url: string, options?: { refetchInterval?: number; refetchOnFocus?: boolean }) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refetchCount, setRefetchCount] = useState(0);

    useEffect(() => {
        let alive = true;
        let intervalId: number | null = null;

        const fetchData = () => {
            // Don't set loading to true on refetch, only on initial load
            if (!data) setLoading(true);
            setError(null);
            jget<T>(url)
                .then(d => { if (alive) setData(d); })
                .catch(e => { if (alive) setError(e as Error); })
                .finally(() => { if (alive) setLoading(false); });
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
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, url, options?.refetchInterval, refetchCount]);

    const refetch = () => {
        setRefetchCount(prev => prev + 1);
    };

    return { data, loading, error, refetch };
}
