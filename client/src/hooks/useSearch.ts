// src/hooks/useSearch.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { API_URL, getHeaders } from '@/lib/api';
import { Course } from '@/types/course';

export function useSearch(query: string) {
  const [results, setResults] = useState<Course[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_URL}/api/courses/search?q=${encodeURIComponent(q)}`, {
          headers: getHeaders(),
          signal: controller.signal,
        });
        
        if (!res.ok) throw new Error('Search failed');
        
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => controller.abort();
  }, [query]);

  return { results, isSearching };
}
