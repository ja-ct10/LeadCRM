'use client';

import { useState, useCallback } from 'react';

/**
 * useLocalStorage — persists state to localStorage without direct browser API calls in components.
 * Encapsulates the anti-pattern of reading/writing localStorage in components (TD-4).
 * 
 * @param key - localStorage key
 * @param initialValue - fallback when key is not set
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full or unavailable — state still works in-memory
      }
      return next;
    });
  }, [key]);

  return [storedValue, setValue];
}
