import { useState, useEffect, useRef, useCallback } from 'react';
import { getCollection, bulkUpsert, bulkDelete } from '../api/client';

export function useDatabaseCollection<T extends { id?: string | number }>(
  tableName: string,
  initialValue: T[]
): [T[], (value: T[] | ((val: T[]) => T[])) => void, boolean] {

  const [data, setData] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);
  const dataRef = useRef<T[]>(initialValue);

  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Initial Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const res = await getCollection<T>(tableName);
        if (mounted && res.success && res.data) {
          const loaded = res.data.length > 0 ? res.data : initialValue;
          setData(loaded);
          dataRef.current = loaded;
        } else if (mounted && !res.success) {
          console.error(`[useDatabaseCollection] Failed to load "${tableName}":`, res.error);
        }
      } catch (err) {
        console.error(`[useDatabaseCollection] Unexpected error loading "${tableName}":`, err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          isInitialized.current = true;
        }
      }
    };
    
    loadData();

    // Listen to real-time changes
    const handleDbChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail === tableName) {
        loadData();
      }
    };
    window.addEventListener('shams-db-change', handleDbChange);

    return () => { 
      mounted = false; 
      window.removeEventListener('shams-db-change', handleDbChange);
    };
  }, [tableName]);

  // ── Smart Diffing Update ────────────────────────────────────────────────────
  const updateData = useCallback((newData: T[] | ((val: T[]) => T[])) => {
    const currentData = dataRef.current;
    const nextState = typeof newData === 'function' ? newData(currentData) : newData;

    // Update UI immediately (optimistic)
    setData(nextState);
    dataRef.current = nextState;

    if (!isInitialized.current) return;

    // Compute diff
    const oldMap = new Map(currentData.map(i => [i.id, i]));
    const nextMap = new Map(nextState.map(i => [i.id, i]));
    const toUpsert: T[] = [];
    const toDelete: (string | number)[] = [];

    for (const item of nextState) {
      if (!item.id) continue;
      const old = oldMap.get(item.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(item)) toUpsert.push(item);
    }
    for (const item of currentData) {
      if (item.id && !nextMap.has(item.id)) toDelete.push(item.id);
    }

    if (toUpsert.length > 0) {
      bulkUpsert(tableName, toUpsert).then(res => {
        if (!res.success) console.error(`[useDatabaseCollection] Upsert failed on "${tableName}":`, res.error);
      });
    }
    if (toDelete.length > 0) {
      bulkDelete(tableName, toDelete).then(res => {
        if (!res.success) console.error(`[useDatabaseCollection] Delete failed on "${tableName}":`, res.error);
      });
    }
  }, [tableName]);

  return [data, updateData, isLoading];
}
