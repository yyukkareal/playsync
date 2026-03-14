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
    if (process.env.NODE_ENV !== 'production') {
      console.count('[effect] useSearch');
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const q = query.trim();
    if (!q) {
      setIsSearching(false);
      setResults([]);
      return;
    }

    let active = true;
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      if (!active) return;
      if (process.env.NODE_ENV !== 'production') {
        console.count('[fetch] useSearch debounce fired');
      }
      setIsSearching(true);
      try {
        const res = await fetch(`${API_URL}/api/courses/search?q=${encodeURIComponent(q)}`, {
          headers: getHeaders(),
          signal: controller.signal,
        });
        
        if (!res.ok) throw new Error('Search failed');
        
        const data = await res.json();
        if (!active) return;
        setResults(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (!active) return;
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        if (!active) return;
        setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      controller.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query]);

  return { results, isSearching };
}
