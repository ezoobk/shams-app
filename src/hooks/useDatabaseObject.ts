import { useState, useEffect, useRef, useCallback } from 'react';
import { getObject, setObject, type ApiResult } from '../api/client';

export function useDatabaseObject<T>(
  keyName: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => Promise<ApiResult>, boolean] {

  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);
  const dataRef = useRef<T>(initialValue);

  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Initial Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const res = await getObject<T>(keyName);
        if (mounted && res.success && res.data !== null && res.data !== undefined) {
          setData(res.data);
          dataRef.current = res.data;
        } else if (mounted && !res.success) {
          console.error(`[useDatabaseObject] Failed to load "${keyName}":`, res.error);
        }
      } catch (err) {
        console.error(`[useDatabaseObject] Unexpected error loading "${keyName}":`, err);
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
      if (customEvent.detail === keyName) {
        loadData();
      }
    };
    window.addEventListener('shams-db-change', handleDbChange);

    return () => { 
      mounted = false; 
      window.removeEventListener('shams-db-change', handleDbChange);
    };
  }, [keyName]);

  // ── Update with Automatic Rollback on Failure ──────────────────────────────
  const updateData = useCallback(async (newData: T | ((val: T) => T)): Promise<ApiResult> => {
    const currentData = dataRef.current;
    const nextState = typeof newData === 'function' ? (newData as (v: T) => T)(currentData) : newData;

    // Update UI immediately (optimistic)
    setData(nextState);
    dataRef.current = nextState;

    if (!isInitialized.current) return { success: true };

    try {
      const res = await setObject(keyName, nextState);
      if (!res.success) {
        console.error(`[useDatabaseObject] Save failed on "${keyName}":`, res.error);
        // Rollback
        setData(currentData);
        dataRef.current = currentData;

        window.dispatchEvent(new CustomEvent('shams-sync-failed', {
          detail: { table: keyName, error: res.error || 'فشل حفظ الكائن' }
        }));
        return res;
      }
      return { success: true };
    } catch (err: any) {
      setData(currentData);
      dataRef.current = currentData;
      return { success: false, error: err.message || 'خطأ في الاتصال' };
    }
  }, [keyName]);

  return [data, updateData, isLoading];
}
