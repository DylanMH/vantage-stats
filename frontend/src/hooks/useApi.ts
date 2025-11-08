// frontend/src/hooks/useApi.ts
import { useEffect, useState } from "react";

// Determine API base URL: use localhost:3000 if loaded from file:// (packaged app)
const API_BASE_URL = window.location.protocol === 'file:' 
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

export function useQuery<T>(key: string, url: string) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        jget<T>(url)
            .then(d => { if (alive) setData(d); })
            .catch(e => { if (alive) setError(e as Error); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [key, url]);

    return { data, loading, error };
}
