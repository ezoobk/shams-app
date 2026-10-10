/**
 * src/api/client.ts
 *
 * طبقة وصول ذكية للبيانات تدعم وضعين:
 *
 *  1. وضع Electron (الجهاز المحلي أو الخادم): يستخدم window.electronAPI (IPC) مباشرة.
 *  2. وضع المتصفح (الأجهزة العميلة): يستخدم HTTP fetch إلى خادم Express على الشبكة.
 *
 * يتم اختيار الوضع تلقائياً بناءً على وجود window.electronAPI.
 */

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL
  ?? (import.meta.env?.DEV ? `http://${window.location.hostname}:3112` : 'http://192.168.2.111:3111');

const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).electronAPI?.dbGetCollection;

// ─── Unified Response Type ─────────────────────────────────────────────────
export interface ApiResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Network Error Handler ──────────────────────────────────────────────────
async function safeFetch<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] HTTP ${response.status} on ${url}:`, text);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    return await response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error(`[API] Request timed out: ${url}`);
      return { success: false, error: 'انتهت مهلة الاتصال بالخادم (timeout). تحقق من الشبكة.' };
    }
    console.error(`[API] Network error on ${url}:`, err.message);
    return { success: false, error: `خطأ في الاتصال بالخادم: ${err.message}` };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/** جلب كامل مجموعة (جدول) من قاعدة البيانات */
export async function getCollection<T>(table: string): Promise<ApiResult<T[]>> {
  if (isElectron()) {
    return (window as any).electronAPI.dbGetCollection(table);
  }
  return safeFetch<T[]>(`${API_BASE_URL}/api/collection/${table}`);
}

/** حفظ/تحديث عناصر في مجموعة */
export async function bulkUpsert(table: string, items: any[]): Promise<ApiResult> {
  if (!items || items.length === 0) return { success: true };
  if (isElectron()) {
    return (window as any).electronAPI.dbBulkUpsert(table, items);
  }
  return safeFetch(`${API_BASE_URL}/api/collection/${table}/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
}

/** حذف عناصر من مجموعة بمعرفاتها */
export async function bulkDelete(table: string, ids: (string | number)[]): Promise<ApiResult> {
  if (!ids || ids.length === 0) return { success: true };
  if (isElectron()) {
    return (window as any).electronAPI.dbBulkDelete(table, ids);
  }
  return safeFetch(`${API_BASE_URL}/api/collection/${table}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

/** جلب كائن من جدول store بمفتاحه */
export async function getObject<T>(key: string): Promise<ApiResult<T>> {
  if (isElectron()) {
    return (window as any).electronAPI.dbGetObject(key);
  }
  return safeFetch<T>(`${API_BASE_URL}/api/store/${encodeURIComponent(key)}`);
}

/** حفظ كائن في جدول store بمفتاحه */
export async function setObject(key: string, value: any): Promise<ApiResult> {
  if (isElectron()) {
    return (window as any).electronAPI.dbSetObject(key, value);
  }
  return safeFetch(`${API_BASE_URL}/api/store/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

/** جلب حالة الترحيل */
export async function getMigrationStatus(): Promise<boolean> {
  if (isElectron()) {
    return (window as any).electronAPI.getMigrationStatus?.() ?? false;
  }
  const res = await safeFetch<boolean>(`${API_BASE_URL}/api/migration-status`);
  return res.success ? (res.data ?? false) : false;
}

/** فحص الاتصال بالخادم (للأجهزة العميلة) */
export async function checkServerHealth(): Promise<boolean> {
  if (isElectron()) return true; // دائماً متصل
  const res = await safeFetch<any>(`${API_BASE_URL}/api/health`);
  return res.success;
}

/** Subscribe to Real-Time Database Changes via SSE */
export function setupRealtimeSync(): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/api/events`);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'DB_CHANGE' && data.table) {
        window.dispatchEvent(new CustomEvent('shams-db-change', { detail: data.table }));
      }
    } catch (e) {
      console.error('[API] SSE parse error:', e);
    }
  };
  eventSource.onerror = () => {
    console.error('[API] SSE Connection Error');
  };
  return () => eventSource.close();
}

export { API_BASE_URL, isElectron };
