import React, { createContext, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useAuth } from './AuthContext';
import { getCollection, bulkUpsert, bulkDelete, getAuditLog } from '../api/client';
import { formatCurrency } from '../utils/formatters';

export type AuditActionType = 'create' | 'edit' | 'delete' | 'print' | 'status_change' | 'login' | 'export';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO String
  userId: string;
  userName: string;
  userDisplayName: string;
  userRole?: string;
  actionType: AuditActionType;
  entityType: string;
  entityId?: string;
  title: string;
  details?: string;

  // Snapshot Rollback / Undo support
  targetCollection?: string; // e.g. 'work_orders', 'estimates', 'invoices', 'shipping_orders', 'users'
  previousState?: any; // Snapshot before action
  nextState?: any; // Snapshot after action
  isReverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
}

export interface LogActivityParams {
  actionType: AuditActionType;
  entityType: string;
  entityId?: string;
  title: string;
  details?: string;
  userId?: string;
  userName?: string;
  userDisplayName?: string;

  // Snapshot Rollback fields
  targetCollection?: string;
  previousState?: any;
  nextState?: any;
}

interface AuditLogContextType {
  logs: AuditLogEntry[];
  isLoading: boolean;
  logActivity: (entry: LogActivityParams) => Promise<void>;
  revertAction: (logId: string) => Promise<{ success: boolean; message: string }>;
  clearLogs: (olderThanDays?: number) => Promise<void>;
}

const AuditLogContext = createContext<AuditLogContextType | undefined>(undefined);

/** Helper to dispatch an audit log event from anywhere without requiring hooks */
export const logAudit = (entry: LogActivityParams) => {
  window.dispatchEvent(new CustomEvent('shams-audit-log', { detail: entry }));
};

const normalizeLogEntry = (entry: any): AuditLogEntry => {
  if (!entry) return entry;
  let parsed = entry;
  if (entry.data) {
    if (typeof entry.data === 'string') {
      try {
        parsed = { ...entry, ...JSON.parse(entry.data) };
      } catch {
        parsed = entry;
      }
    } else if (typeof entry.data === 'object') {
      parsed = { ...entry, ...entry.data };
    }
  }
  const result: any = {
    ...parsed,
    id: String(parsed.id || entry.id),
    timestamp: parsed.timestamp || entry.timestamp || new Date().toISOString(),
    userId: parsed.userId || 'admin-root',
    userName: parsed.userName || 'admin',
    userDisplayName: parsed.userDisplayName || 'المدير',
    userRole: parsed.userRole || 'admin',
    actionType: parsed.actionType || 'create',
    entityType: parsed.entityType || 'عام',
    entityId: parsed.entityId ? String(parsed.entityId) : undefined,
    title: parsed.title || '--',
    details: parsed.details || '',
    targetCollection: parsed.targetCollection,
    previousState: parsed.previousState,
    nextState: parsed.nextState,
    isReverted: !!parsed.isReverted,
    revertedAt: parsed.revertedAt,
    revertedBy: parsed.revertedBy
  };
  delete result.data;
  return result as AuditLogEntry;
};

export const AuditLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [rawLogs, setRawLogs, isLoading] = useDatabaseCollection<any>('audit_logs', []);
  const isBootstrapped = useRef(false);

  const logs = useMemo(() => {
    return rawLogs.map(normalizeLogEntry);
  }, [rawLogs]);

  const setLogs = useCallback((updater: AuditLogEntry[] | ((prev: AuditLogEntry[]) => AuditLogEntry[])) => {
    return setRawLogs(prev => {
      const normalizedPrev = prev.map(normalizeLogEntry);
      const next = typeof updater === 'function' ? updater(normalizedPrev) : updater;
      return next.map(normalizeLogEntry);
    });
  }, [setRawLogs]);

  // Initial seed from existing documents if collection is completely empty
  useEffect(() => {
    if (!isLoading && logs.length === 0 && !isBootstrapped.current) {
      isBootstrapped.current = true;
      const initialLogs: AuditLogEntry[] = [];

      try {
        // 1. Invoices
        const rawInvs = localStorage.getItem('shams_invoices');
        if (rawInvs) {
          const invs = JSON.parse(rawInvs);
          if (Array.isArray(invs)) {
            invs.slice(0, 50).forEach((inv: any) => {
              initialLogs.push({
                id: `init-inv-${inv.id}`,
                timestamp: inv.date || new Date().toISOString(),
                userId: 'admin-root',
                userName: 'admin',
                userDisplayName: 'المدير',
                userRole: 'admin',
                actionType: 'create',
                entityType: 'فواتير المبيعات',
                entityId: inv.id,
                title: `إنشاء فاتورة ${inv.type === 'final' ? 'نهائية' : 'مبدئية'}: ${inv.id}`,
                details: `العميل: ${inv.customerName || '--'} | الإجمالي: ${inv.totalAmount ? formatCurrency(inv.totalAmount) : '--'} د.ل`,
                targetCollection: 'invoices',
                nextState: inv
              });
            });
          }
        }

        // 2. Work Orders
        const rawWOs = localStorage.getItem('shams_workOrders');
        if (rawWOs) {
          const wos = JSON.parse(rawWOs);
          if (Array.isArray(wos)) {
            wos.slice(0, 50).forEach((wo: any) => {
              const descs = (wo.items || []).map((i: any) => i.desc).filter(Boolean).join('، ');
              initialLogs.push({
                id: `init-wo-${wo.id}`,
                timestamp: wo.date || new Date().toISOString(),
                userId: 'admin-root',
                userName: 'admin',
                userDisplayName: 'المدير',
                userRole: 'admin',
                actionType: 'create',
                entityType: 'أوامر التصنيع',
                entityId: wo.id,
                title: `إنشاء أمر تصنيع: ${wo.id}`,
                details: `المنتجات: ${descs || '--'} (${wo.items?.length || 0} بنود)`,
                targetCollection: 'work_orders',
                nextState: wo
              });
            });
          }
        }

        // 3. Shipping Orders
        const rawSOs = localStorage.getItem('shams_shippingOrders');
        if (rawSOs) {
          const sos = JSON.parse(rawSOs);
          if (Array.isArray(sos)) {
            sos.slice(0, 50).forEach((so: any) => {
              initialLogs.push({
                id: `init-so-${so.id}`,
                timestamp: so.date || new Date().toISOString(),
                userId: 'admin-root',
                userName: 'admin',
                userDisplayName: 'المدير',
                userRole: 'admin',
                actionType: 'create',
                entityType: 'أوامر النقل',
                entityId: so.id,
                title: `إنشاء أمر نقل: ${so.id}`,
                details: `السائق: ${so.driverName || '--'} | الوجهة: ${so.destination || '--'}`,
                targetCollection: 'shipping_orders',
                nextState: so
              });
            });
          }
        }

        // 4. Estimates
        const rawEsts = localStorage.getItem('shams_estimates');
        if (rawEsts) {
          const ests = JSON.parse(rawEsts);
          if (Array.isArray(ests)) {
            ests.slice(0, 50).forEach((est: any) => {
              initialLogs.push({
                id: `init-est-${est.id}`,
                timestamp: est.date || new Date().toISOString(),
                userId: 'admin-root',
                userName: 'admin',
                userDisplayName: 'المدير',
                userRole: 'admin',
                actionType: 'create',
                entityType: 'التقديرات',
                entityId: String(est.id),
                title: `إنشاء تقدير: ${est.desc || est.id}`,
                details: `سعر البيع المقترح: ${est.sellPrice ? formatCurrency(est.sellPrice) : '--'} د.ل`,
                targetCollection: 'estimates',
                nextState: est
              });
            });
          }
        }
      } catch (err) {
        console.warn('Initial audit log seeding skipped:', err);
      }

      if (initialLogs.length > 0) {
        initialLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(initialLogs);
      }
    }
  }, [isLoading, logs.length, setLogs]);

  const logActivity = useCallback(async (entry: LogActivityParams) => {
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: entry.userId || currentUser?.id || 'admin-root',
      userName: entry.userName || currentUser?.username || 'admin',
      userDisplayName: entry.userDisplayName || currentUser?.displayName || 'المدير',
      userRole: currentUser?.role || 'admin',
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      title: entry.title,
      details: entry.details,
      targetCollection: entry.targetCollection,
      previousState: entry.previousState,
      nextState: entry.nextState,
      isReverted: false
    };

    setLogs(prev => {
      const updated = [newLog, ...prev];
      if (updated.length > 5000) {
        return updated.slice(0, 5000);
      }
      return updated;
    });
  }, [currentUser, setLogs]);

  // Listen to shams-audit-log window events
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<LogActivityParams>;
      if (customEvent.detail) {
        logActivity(customEvent.detail);
      }
    };

    window.addEventListener('shams-audit-log', handleEvent);
    return () => window.removeEventListener('shams-audit-log', handleEvent);
  }, [logActivity]);

  // Rollback / Undo implementation
  const revertAction = async (logId: string): Promise<{ success: boolean; message: string }> => {
    let log = logs.find((l: AuditLogEntry) => l.id === logId);
    if (!log) {
      return { success: false, message: 'سجل الحركة غير موجود.' };
    }
    if (log.isReverted) {
      return { success: false, message: 'تم التراجع عن هذه الحركة مسبقاً.' };
    }
    if (!log.previousState && (log as any).hasPreviousState) {
      try {
        const fullRes = await getAuditLog(logId);
        if (fullRes.success && fullRes.data) {
          log = { ...log, ...fullRes.data };
        }
      } catch (e) {
        console.error('Failed to load full audit log for revert:', e);
      }
    }
    if (!log.targetCollection) {
      return { success: false, message: 'هذه الحركة لا تدعم التراجع التلقائي لأنها لا تتضمن لقطة حالة سابقة.' };
    }

    try {
      const table = log.targetCollection;

      // ── 1. Work Orders Reversal ────────────────────────────────────────────
      if (table === 'work_orders') {
        if (log.actionType === 'create') {
          // Check if any items in this work order have been sold or shipped
          const woRes = await getCollection<any>('work_orders');
          const allWos = woRes.data || [];
          const targetWo = allWos.find(w => String(w.id) === String(log.entityId));
          if (!targetWo) {
            return { success: false, message: 'أمر التصنيع غير موجود في النظام (ربما تم إلغاؤه بالفعل).' };
          }

          const invRes = await getCollection<any>('invoices');
          const allInvs = invRes.data || [];
          const shpRes = await getCollection<any>('shipping_orders');
          const allShps = shpRes.data || [];

          const sns = (targetWo.items || []).map((i: any) => i.serialNumber).filter(Boolean);
          const linkedInv = allInvs.find(inv => (inv.items || []).some((i: any) => sns.includes(i.serialNumber)));
          if (linkedInv) {
            return {
              success: false,
              message: `لا يمكن التراجع عن أمر التصنيع لأن أحد منتجاته تم بيعه في الفاتورة رقم (${linkedInv.id}). يرجى إلغاء الفاتورة أولاً.`
            };
          }

          const linkedShp = allShps.find(shp => (shp.items || []).some((i: any) => sns.includes(i.serialNumber)));
          if (linkedShp) {
            return {
              success: false,
              message: `لا يمكن التراجع عن أمر التصنيع لأن أحد منتجاته تم نقله في أمر النقل رقم (${linkedShp.id}). يرجى إلغاء أمر النقل أولاً.`
            };
          }

          // Safe to delete work order
          const delRes = await bulkDelete('work_orders', [log.entityId!]);
          if (!delRes.success) throw new Error(delRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
        } 
        else if (log.actionType === 'edit') {
          if (!log.previousState) {
            return { success: false, message: 'لا توجد بيانات سابقة محفوظة للتراجع عن هذا التعديل.' };
          }
          const upRes = await bulkUpsert('work_orders', [log.previousState]);
          if (!upRes.success) throw new Error(upRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
        } 
        else if (log.actionType === 'delete') {
          if (!log.previousState) {
            return { success: false, message: 'لا توجد بيانات محفوظة لاستعادة أمر التصنيع المحذوف.' };
          }
          const upRes = await bulkUpsert('work_orders', [log.previousState]);
          if (!upRes.success) throw new Error(upRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
        } 
        else if (log.actionType === 'status_change') {
          if (!log.previousState?.woId || !log.previousState?.serialNumber) {
            return { success: false, message: 'بيانات استعادة الحالة غير مكتملة.' };
          }
          const woRes = await getCollection<any>('work_orders');
          const allWos = woRes.data || [];
          const targetWo = allWos.find(w => String(w.id) === String(log.previousState.woId));
          if (!targetWo) return { success: false, message: 'أمر التصنيع غير موجود.' };

          const updatedItems = (targetWo.items || []).map((item: any) => {
            if (item.serialNumber === log.previousState.serialNumber) {
              return { ...item, mfgStatus: log.previousState.mfgStatus };
            }
            return item;
          });
          const upRes = await bulkUpsert('work_orders', [{ ...targetWo, items: updatedItems }]);
          if (!upRes.success) throw new Error(upRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
        }
      }

      // ── 2. Invoices Reversal ────────────────────────────────────────────────
      else if (table === 'invoices') {
        if (log.actionType === 'create') {
          // If invoice is final, release its products back to ready status in work orders
          const invRes = await getCollection<any>('invoices');
          const targetInv = (invRes.data || []).find(i => String(i.id) === String(log.entityId));
          if (targetInv && targetInv.type === 'نهائية') {
            const sns = (targetInv.items || []).map((i: any) => i.serialNumber).filter(Boolean);
            if (sns.length > 0) {
              const woRes = await getCollection<any>('work_orders');
              const allWos = woRes.data || [];
              const updatedWos: any[] = [];
              allWos.forEach(wo => {
                let changed = false;
                const newItems = (wo.items || []).map((wi: any) => {
                  if (wi.serialNumber && sns.includes(wi.serialNumber)) {
                    changed = true;
                    return { ...wi, status: wi.mfgStatus || 'جاهز' };
                  }
                  return wi;
                });
                if (changed) updatedWos.push({ ...wo, items: newItems });
              });
              if (updatedWos.length > 0) {
                await bulkUpsert('work_orders', updatedWos);
                window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
              }
            }
          }

          const delRes = await bulkDelete('invoices', [log.entityId!]);
          if (!delRes.success) throw new Error(delRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'invoices' }));
        }
        else if (log.actionType === 'edit') {
          if (!log.previousState) return { success: false, message: 'لا توجد بيانات سابقة محفوظة للفاتورة.' };
          const upRes = await bulkUpsert('invoices', [log.previousState]);
          if (!upRes.success) throw new Error(upRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'invoices' }));
        }
        else if (log.actionType === 'delete') {
          // Restore from deleted_invoices back to invoices
          if (!log.previousState) return { success: false, message: 'لا توجد بيانات سابقة محفوظة للفاتورة.' };
          await bulkDelete('deleted_invoices', [log.entityId!]);
          await bulkUpsert('invoices', [log.previousState]);

          // If final invoice, re-mark products as sold
          if (log.previousState.type === 'نهائية') {
            const sns = (log.previousState.items || []).map((i: any) => i.serialNumber).filter(Boolean);
            if (sns.length > 0) {
              const woRes = await getCollection<any>('work_orders');
              const allWos = woRes.data || [];
              const updatedWos: any[] = [];
              allWos.forEach(wo => {
                let changed = false;
                const newItems = (wo.items || []).map((wi: any) => {
                  if (wi.serialNumber && sns.includes(wi.serialNumber)) {
                    changed = true;
                    return { ...wi, status: 'مباع' };
                  }
                  return wi;
                });
                if (changed) updatedWos.push({ ...wo, items: newItems });
              });
              if (updatedWos.length > 0) {
                await bulkUpsert('work_orders', updatedWos);
                window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
              }
            }
          }

          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'invoices' }));
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'deleted_invoices' }));
        }
      }

      // ── 3. Shipping Orders Reversal ────────────────────────────────────────
      else if (table === 'shipping_orders') {
        if (log.actionType === 'create') {
          const shpRes = await getCollection<any>('shipping_orders');
          const targetShp = (shpRes.data || []).find(s => String(s.id) === String(log.entityId));
          const itemsSource = targetShp?.items || log.nextState?.items || [];
          const sns = itemsSource.map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);
          if (sns.length > 0) {
            const woRes = await getCollection<any>('work_orders');
            const allWos = woRes.data || [];
            const updatedWos: any[] = [];
            allWos.forEach(wo => {
              let changed = false;
              const newItems = (wo.items || []).map((wi: any) => {
                const sn = wi.serialNumber?.trim();
                if (sn && sns.includes(sn)) {
                  changed = true;
                  const copy = { ...wi, shippingStatus: 'غير منقولة' };
                  delete copy.shippingOrderId;
                  delete copy.shippingOrderDate;
                  return copy;
                }
                return wi;
              });
              if (changed) updatedWos.push({ ...wo, items: newItems });
            });
            if (updatedWos.length > 0) {
              await bulkUpsert('work_orders', updatedWos);
              window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
            }
          }

          const delRes = await bulkDelete('shipping_orders', [log.entityId!]);
          if (!delRes.success) throw new Error(delRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'shipping_orders' }));
        }
        else if (log.actionType === 'edit') {
          if (!log.previousState) return { success: false, message: 'لا توجد بيانات سابقة محفوظة لأمر النقل.' };
          const upRes = await bulkUpsert('shipping_orders', [log.previousState]);
          if (!upRes.success) throw new Error(upRes.error);

          // مزامنة حالة المنتجات في أوامر التصنيع مع الحالة السابقة لأمر النقل
          const prevSns = (log.previousState.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);
          const nextSns = (log.nextState?.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);
          const removedInRevert = nextSns.filter((s: string) => !prevSns.includes(s));

          const woRes = await getCollection<any>('work_orders');
          const allWos = woRes.data || [];
          const updatedWos: any[] = [];
          allWos.forEach(wo => {
            let changed = false;
            const newItems = (wo.items || []).map((wi: any) => {
              const sn = wi.serialNumber?.trim();
              if (sn && removedInRevert.includes(sn)) {
                changed = true;
                const copy = { ...wi, shippingStatus: 'غير منقولة' };
                delete copy.shippingOrderId;
                delete copy.shippingOrderDate;
                return copy;
              }
              if (sn && prevSns.includes(sn)) {
                changed = true;
                return {
                  ...wi,
                  shippingStatus: 'منقولة',
                  shippingOrderId: log.previousState.id,
                  shippingOrderDate: log.previousState.date
                };
              }
              return wi;
            });
            if (changed) updatedWos.push({ ...wo, items: newItems });
          });
          if (updatedWos.length > 0) {
            await bulkUpsert('work_orders', updatedWos);
            window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
          }

          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'shipping_orders' }));
        }
        else if (log.actionType === 'delete') {
          if (!log.previousState) return { success: false, message: 'لا توجد بيانات سابقة محفوظة لأمر النقل.' };
          await bulkUpsert('shipping_orders', [log.previousState]);
          const sns = (log.previousState.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);
          if (sns.length > 0) {
            const woRes = await getCollection<any>('work_orders');
            const allWos = woRes.data || [];
            const updatedWos: any[] = [];
            allWos.forEach(wo => {
              let changed = false;
              const newItems = (wo.items || []).map((wi: any) => {
                const sn = wi.serialNumber?.trim();
                if (sn && sns.includes(sn)) {
                  changed = true;
                  return { 
                    ...wi, 
                    shippingStatus: 'منقولة',
                    shippingOrderId: log.previousState.id,
                    shippingOrderDate: log.previousState.date
                  };
                }
                return wi;
              });
              if (changed) updatedWos.push({ ...wo, items: newItems });
            });
            if (updatedWos.length > 0) {
              await bulkUpsert('work_orders', updatedWos);
              window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
            }
          }
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'shipping_orders' }));
        }
      }

      // ── 4. Estimates & Other General Collections ───────────────────────────
      else {
        if (log.actionType === 'create') {
          const rawId = String(log.entityId);
          const candidateIds = Array.from(new Set([rawId, `${rawId}.0`, rawId.replace(/\.0$/, '')]));
          const delRes = await bulkDelete(table, candidateIds);
          if (!delRes.success) throw new Error(delRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: table }));
        } else if (log.actionType === 'edit' || log.actionType === 'delete') {
          if (!log.previousState) return { success: false, message: 'لا توجد بيانات سابقة محفوظة للتراجع.' };
          const upRes = await bulkUpsert(table, [log.previousState]);
          if (!upRes.success) throw new Error(upRes.error);
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: table }));
        }
      }

      // ── 5. Mark the audit log entry as reverted ─────────────────────────────
      const revertedLog: AuditLogEntry = {
        ...log,
        isReverted: true,
        revertedAt: new Date().toISOString(),
        revertedBy: currentUser?.displayName || 'المدير'
      };

      setLogs(prev => prev.map(l => l.id === logId ? revertedLog : l));

      // ── 6. Log the reversal action itself for complete accountability ──────
      await logActivity({
        actionType: 'edit',
        entityType: log.entityType,
        entityId: log.entityId,
        title: `تراجع عن حركة "${log.title}"`,
        details: `تم إلغاء أثر الحركة (${log.id}) وإعادة الحالة السابقة بنجاح بواسطة: ${currentUser?.displayName || 'المدير'}`
      });

      return { success: true, message: `تم التراجع عن حركة "${log.title}" بنجاح!` };
    } catch (err: any) {
      console.error('Error during action reversal:', err);
      return { success: false, message: `فشل التراجع: ${err.message || 'حدث خطأ غير متوقع'}` };
    }
  };

  const clearLogs = async (olderThanDays?: number) => {
    if (olderThanDays !== undefined && olderThanDays > 0) {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      setLogs(prev => prev.filter(log => new Date(log.timestamp).getTime() >= cutoffTime));
    } else {
      setLogs([]);
    }
  };

  return (
    <AuditLogContext.Provider value={{ logs, isLoading, logActivity, revertAction, clearLogs }}>
      {children}
    </AuditLogContext.Provider>
  );
};

export const useAuditLog = () => {
  const context = useContext(AuditLogContext);
  if (!context) {
    throw new Error('useAuditLog must be used within an AuditLogProvider');
  }
  return context;
};
