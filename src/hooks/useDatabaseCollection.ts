import { useState, useEffect, useRef, useCallback } from 'react';
import { getCollection, bulkUpsert, bulkDelete, type ApiResult } from '../api/client';

export function useDatabaseCollection<T extends { id?: string | number }>(
  tableName: string,
  initialValue: T[]
): [T[], (value: T[] | ((val: T[]) => T[])) => Promise<ApiResult>, boolean] {

  const [data, setData] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);
  const dataRef = useRef<T[]>(initialValue);
  const lastLocalMutationRef = useRef<number>(0);

  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Initial Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const res = await getCollection<T>(tableName);
        if (mounted && res.success && res.data) {
          if (res.data.length === 0 && initialValue && initialValue.length > 0) {
            // Persist defaults to database immediately so they are never lost on subsequent adds
            bulkUpsert(tableName, initialValue).catch(err => {
              console.error(`[useDatabaseCollection] Failed to seed initialValue for "${tableName}":`, err);
            });
            setData(initialValue);
            dataRef.current = initialValue;
          } else {
            setData(res.data);
            dataRef.current = res.data;
          }
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
        // If this update was triggered by our own local mutation recently, ignore echo to prevent duplicate heavy loadData
        if (Date.now() - lastLocalMutationRef.current < 2500) {
          return;
        }
        loadData();
      }
    };
    window.addEventListener('shams-db-change', handleDbChange);

    return () => { 
      mounted = false; 
      window.removeEventListener('shams-db-change', handleDbChange);
    };
  }, [tableName]);

  // ── Smart Diffing Update with Automatic Rollback on Failure ────────────────
  const updateData = useCallback(async (newData: T[] | ((val: T[]) => T[])): Promise<ApiResult> => {
    const currentData = dataRef.current;
    const nextState = typeof newData === 'function' ? newData(currentData) : newData;

    if (!isInitialized.current) {
      setData(nextState);
      dataRef.current = nextState;
      return { success: true };
    }

    // Fast-path reference check: identical array reference
    if (nextState === currentData) {
      return { success: true };
    }

    lastLocalMutationRef.current = Date.now();

    // Compute diff
    const oldMap = new Map(currentData.map(i => [i.id, i]));
    const nextMap = new Map(nextState.map(i => [i.id, i]));
    const toUpsert: T[] = [];
    const toDelete: (string | number)[] = [];

    for (const item of nextState) {
      if (!item.id) continue;
      const old = oldMap.get(item.id);
      // Fast reference check: if identical reference, object was untouched!
      if (old === item) continue;
      if (!old || JSON.stringify(old) !== JSON.stringify(item)) toUpsert.push(item);
    }
    for (const item of currentData) {
      if (item.id && !nextMap.has(item.id)) toDelete.push(item.id);
    }

    if (toUpsert.length === 0 && toDelete.length === 0) {
      setData(nextState);
      dataRef.current = nextState;
      return { success: true };
    }

    // Update UI optimistically
    setData(nextState);
    dataRef.current = nextState;

    try {
      let upsertRes: ApiResult = { success: true };
      let deleteRes: ApiResult = { success: true };

      if (toUpsert.length > 0) {
        upsertRes = await bulkUpsert(tableName, toUpsert);
      }
      if (toDelete.length > 0) {
        deleteRes = await bulkDelete(tableName, toDelete);
      }

      if (!upsertRes.success || !deleteRes.success) {
        const errorMsg = upsertRes.error || deleteRes.error || 'فشل الاتصال بقاعدة البيانات';
        console.error(`[useDatabaseCollection] Sync failed on "${tableName}":`, errorMsg);

        // التراجع الفوري عن التحديث التفاؤلي لحماية المستخدم من البيانات الوهمية
        setData(currentData);
        dataRef.current = currentData;

        window.dispatchEvent(new CustomEvent('shams-sync-failed', {
          detail: { table: tableName, error: errorMsg }
        }));

        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (err: any) {
      setData(currentData);
      dataRef.current = currentData;
      return { success: false, error: err.message || 'خطأ في الاتصال' };
    }
  }, [tableName]);

  return [data, updateData, isLoading];
}
