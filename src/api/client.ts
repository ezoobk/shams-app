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

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const { hostname, origin } = window.location;

    // 1. وضع التطوير (Vite Dev Server)
    if (import.meta.env?.DEV) {
      return `http://${hostname}:3112`;
    }

    // 2. إذا تم فتح الرابط من الشبكة المحلية (LAN أو Localhost):
    // يجب دائماً استخدام عنوان الشبكة المحلية مباشرة (Origin) لسرعة فائقة (1ms) وتفادي الدوران عبر الإنترنت وسيرفرات Cloudflare
    const isLocalLan =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.local');

    if (isLocalLan) {
      return origin;
    }

    // 3. إذا فُتح عبر نطاق خارجي (مثل https://erb.shams.com.ly):
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      return origin;
    }
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim();
  }

  return 'https://erb.shams.com.ly';
}

const API_BASE_URL = resolveApiBaseUrl();

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
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
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

/** جلب سجل تدقيق مفرد بكامل بياناته وتفاصيل التراجع */
export async function getAuditLog(id: string): Promise<ApiResult<any>> {
  if (isElectron() && (window as any).electronAPI?.dbGetAuditLog) {
    return (window as any).electronAPI.dbGetAuditLog(id);
  }
  return safeFetch<any>(`${API_BASE_URL}/api/collection/audit_logs/${id}`);
}

/** جلب مرفقات تقدير عند الطلب بكامل صورها */
export async function getEstimateAttachments(id: string | number): Promise<ApiResult<any[]>> {
  if (isElectron() && (window as any).electronAPI?.dbGetEstimateAttachments) {
    return (window as any).electronAPI.dbGetEstimateAttachments(id);
  }
  return safeFetch<any[]>(`${API_BASE_URL}/api/estimates/${id}/attachments`);
}

/** جلب أمر تصنيع مفرد بكامل بنوده ومرفقاته */
export async function getWorkOrder(id: string): Promise<ApiResult<any>> {
  if (isElectron() && (window as any).electronAPI?.dbGetWorkOrder) {
    return (window as any).electronAPI.dbGetWorkOrder(id);
  }
  return safeFetch<any>(`${API_BASE_URL}/api/work_orders/${id}`);
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

/** طلب وتوليد الرقم التسلسلي القادم ذرياً من الخادم الرئيسي */
export async function requestNextId(
  type: string,
  customerName = '',
  extraText = '',
  yearOverride?: number
): Promise<ApiResult<string>> {
  if (isElectron()) {
    try {
      const res = await (window as any).electronAPI.dbGenerateId({ type, customerName, extraText, yearOverride });
      const id = res?.id || res?.data?.id || (typeof res?.data === 'string' ? res.data : undefined);
      if (res && res.success && id) {
        return { success: true, data: id };
      }
      return { success: false, error: res?.error || 'فشل توليد الرقم من الجهاز المحلي' };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطأ في استدعاء معالج الأرقام' };
    }
  }

  const res = await safeFetch<any>(`${API_BASE_URL}/api/generate-id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, customerName, extraText, yearOverride }),
  });

  const generatedId = res?.id || res?.data?.id || (typeof res?.data === 'string' ? res.data : undefined);
  if (res && res.success && generatedId) {
    return { success: true, data: generatedId };
  }
  return { success: false, error: res?.error || (res?.data && res?.data?.error) || 'تعذر حجز الرقم الإشاري من الخادم الرئيسي' };
}

/** Subscribe to Real-Time Database Changes via SSE with Connection Tracking */
export function setupRealtimeSync(): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/api/events`);

  eventSource.onopen = () => {
    window.dispatchEvent(new CustomEvent('shams-connection-status', { detail: { online: true } }));
  };

  eventSource.onmessage = (event) => {
    window.dispatchEvent(new CustomEvent('shams-connection-status', { detail: { online: true } }));
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
    window.dispatchEvent(new CustomEvent('shams-connection-status', { detail: { online: false } }));
    console.error('[API] SSE Connection Error');
  };

  return () => eventSource.close();
}

// ─── Backups Client API ───────────────────────────────────────────────────

export interface BackupItem {
  id: string;
  fileName: string;
  filePath: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'auto' | 'manual' | 'pre_restore';
}

export interface BackupDestination {
  id: string;
  name: string;
  path: string;
  type: 'local' | 'gdrive_folder' | 'external' | 'network';
  enabled: boolean;
  isDefault?: boolean;
  lastBackupTime?: string | null;
  lastStatus?: string | null;
}

export interface GoogleDriveCloudConfig {
  enabled: boolean;
  folderId?: string;
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
  lastUploadTime?: string | null;
  lastUploadFile?: string | null;
  lastUploadStatus?: string | null;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  time1: string;
  time2: string;
  customBackupFolder?: string | null;
  maxBackupsToKeep?: number;
  destinations?: BackupDestination[];
  googleDriveCloud?: GoogleDriveCloudConfig;
  lastBackupTime?: string | null;
  lastBackupFileName?: string | null;
  lastBackupType?: string | null;
}

export async function fetchBackupsList(): Promise<ApiResult<{ data: BackupItem[]; backupFolder: string; config: BackupConfig }>> {
  let res: any;
  if (isElectron() && (window as any).electronAPI?.backupList) {
    res = await (window as any).electronAPI.backupList();
  } else {
    res = await safeFetch(`${API_BASE_URL}/api/backups`);
  }
  
  if (res && res.success) {
    const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
    const folder = res.backupFolder || res.data?.backupFolder || '';
    const config = res.config || res.data?.config || {};
    return {
      success: true,
      data: {
        data: list,
        backupFolder: folder,
        config
      }
    };
  }
  return res || { success: false, error: 'تعذر جلب قائمة النسخ الاحتياطية' };
}

export async function createNewBackup(type: 'manual' | 'auto' = 'manual'): Promise<ApiResult<BackupItem>> {
  let res: any;
  if (isElectron() && (window as any).electronAPI?.backupCreate) {
    res = await (window as any).electronAPI.backupCreate(type);
  } else {
    res = await safeFetch(`${API_BASE_URL}/api/backups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
  }
  
  if (res && res.success) {
    const item = res.data || res;
    return {
      success: true,
      data: item
    };
  }
  return res || { success: false, error: 'فشل إنشاء النسخة الاحتياطية' };
}

export async function restoreBackupFile(fileName: string): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupRestore) {
    return (window as any).electronAPI.backupRestore(fileName);
  }
  return safeFetch(`${API_BASE_URL}/api/backups/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName })
  });
}

export async function deleteBackupFile(fileName: string): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupDelete) {
    return (window as any).electronAPI.backupDelete(fileName);
  }
  return safeFetch(`${API_BASE_URL}/api/backups/${encodeURIComponent(fileName)}`, {
    method: 'DELETE'
  });
}

export async function fetchBackupConfig(): Promise<ApiResult<{ data: BackupConfig; backupFolder: string }>> {
  if (isElectron() && (window as any).electronAPI?.backupGetConfig) {
    return (window as any).electronAPI.backupGetConfig();
  }
  return safeFetch(`${API_BASE_URL}/api/backups/config`);
}

export async function saveBackupConfig(cfg: Partial<BackupConfig>): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupSetConfig) {
    return (window as any).electronAPI.backupSetConfig(cfg);
  }
  return safeFetch(`${API_BASE_URL}/api/backups/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg)
  });
}

export async function openBackupFolder(): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupOpenFolder) {
    return (window as any).electronAPI.backupOpenFolder();
  }
  return { success: false, error: 'فتح المجلد متاح فقط في التطبيق المكتبي الرئيسي.' };
}

export async function changeBackupFolder(): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupChangeFolder) {
    return (window as any).electronAPI.backupChangeFolder();
  }
  return { success: false, error: 'تغيير المجلد متاح فقط في التطبيق المكتبي الرئيسي.' };
}

export async function pickBackupFolder(title?: string): Promise<ApiResult<{ folderPath: string }>> {
  if (isElectron() && (window as any).electronAPI?.backupPickFolder) {
    return (window as any).electronAPI.backupPickFolder(title);
  }
  return { success: false, error: 'اختيار المجلدات متاح في التطبيق المكتبي الرئيسي.' };
}

export async function testBackupDestination(folderPath: string): Promise<ApiResult<{ accessible: boolean }>> {
  if (isElectron() && (window as any).electronAPI?.backupTestDestination) {
    return (window as any).electronAPI.backupTestDestination(folderPath);
  }
  return safeFetch(`${API_BASE_URL}/api/backups/test-destination`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath })
  });
}

export async function testGoogleDriveConfig(params: { email: string; key: string; folderId?: string }): Promise<ApiResult<{ message?: string }>> {
  if (isElectron() && (window as any).electronAPI?.backupTestGoogleDrive) {
    return (window as any).electronAPI.backupTestGoogleDrive(params);
  }
  return safeFetch(`${API_BASE_URL}/api/backups/test-gdrive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
}

export async function detectGoogleDriveFolders(): Promise<ApiResult<string[]>> {
  if (isElectron() && (window as any).electronAPI?.backupDetectGoogleDrive) {
    return (window as any).electronAPI.backupDetectGoogleDrive();
  }
  return safeFetch(`${API_BASE_URL}/api/backups/detect-gdrive`);
}

export async function exportBackupFile(fileName: string): Promise<ApiResult> {
  if (isElectron() && (window as any).electronAPI?.backupExportFile) {
    return (window as any).electronAPI.backupExportFile(fileName);
  }
  // في المتصفح، يتم تنزيل الملف مباشرة
  window.open(`${API_BASE_URL}/api/backups/download/${encodeURIComponent(fileName)}`, '_blank');
  return { success: true };
}

// ─── ZKTeco Biometric API ───────────────────────────────────────────────────

export async function zkTestConnection(options?: string | { mode?: 'direct' | 'file'; ip?: string; port?: number; path?: string }): Promise<ApiResult<any>> {
  if (isElectron() && (window as any).electronAPI?.zkTestConnection) {
    return (window as any).electronAPI.zkTestConnection(options);
  }
  let query = '';
  if (typeof options === 'string') {
    query = `?path=${encodeURIComponent(options)}`;
  } else if (options) {
    const params = new URLSearchParams();
    if (options.mode) params.set('mode', options.mode);
    if (options.ip) params.set('ip', options.ip);
    if (options.port) params.set('port', String(options.port));
    if (options.path) params.set('path', options.path);
    query = `?${params.toString()}`;
  }
  return safeFetch(`${API_BASE_URL}/api/zkteco/test${query}`);
}

export async function zkSyncAttendance(options?: {
  mode?: 'direct' | 'file';
  ip?: string;
  port?: number;
  path?: string;
  fullSync?: boolean;
  matchActiveOnly?: boolean;
  purgeMissing?: boolean;
  logsOnly?: boolean;
  syncEmployees?: boolean;
}): Promise<ApiResult<any>> {
  if (isElectron() && (window as any).electronAPI?.zkSyncAttendance) {
    return (window as any).electronAPI.zkSyncAttendance(options);
  }
  return safeFetch(`${API_BASE_URL}/api/zkteco/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {})
  });
}

export async function zkGetStats(): Promise<ApiResult<any>> {
  if (isElectron() && (window as any).electronAPI?.zkGetStats) {
    return (window as any).electronAPI.zkGetStats();
  }
  return safeFetch(`${API_BASE_URL}/api/zkteco/stats`);
}

export { API_BASE_URL, isElectron };
