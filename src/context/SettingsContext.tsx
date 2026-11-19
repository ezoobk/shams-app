import React, { createContext, useContext, useRef } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { AppSettings } from '../types';

import { getCollection, requestNextId } from '../api/client';

interface SettingsContextType {
  appSettings: AppSettings;
  setAppSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  idCounters: any;
  setIdCounters: (counters: any | ((prev: any) => any)) => void;
  idCountersRef: React.MutableRefObject<any>;
  generateId: (type: string, customerName?: string, extraText?: string, yearOverride?: number) => string;
  generateIdAsync: (type: string, customerName?: string, extraText?: string, yearOverride?: number) => Promise<string>;
  auditAndHealCounters: (triggerTable?: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Default fallback for brand new empty database
const DEFAULT_COUNTERS = {
  ref: 402,
  wo: 179,
  sn: 4210,
  pinv: 2,
  inv: 1
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appSettings, setAppSettings] = useDatabaseObject<AppSettings>('shams_appSettings', {
    companyNameAr: 'شمس للأعمال المعدنية\nوالبيوت المتنقلة',
    companyNameEn: 'Shams Co.\nFor Metal Fabrication',
    address: 'الزاوية - ليبيا',
    cr: 'السجل التجاري: 20181',
    phones: '0912139543 - 0912122870',
    email: 'Email: shams@smf.com.ly',
    website: 'Web: smf.com.ly',
    logoBase64: null,
    outboundLogPath: null,
    printScale: 90
  });

  const [idCounters, setIdCounters] = useDatabaseObject('shams_idCounters', DEFAULT_COUNTERS);
  
  // We sync the state to a ref for synchronous access in generateId
  const idCountersRef = useRef(idCounters);
  
  // Targeted audit and heal: each entity only updates its OWN counter
  const auditAndHealCounters = React.useCallback(async (triggerTable?: string) => {
    try {
      const current = { ...(idCountersRef.current || {}) };
      let changed = false;

      // 1. Purchase Invoices: ONLY audits 'pinv'
      if (!triggerTable || triggerTable === 'purchase_invoices') {
        const pinvRes = await getCollection<any>('purchase_invoices');
        let maxPinv = 0;
        if (pinvRes.success && Array.isArray(pinvRes.data)) {
          for (const p of pinvRes.data) {
            if (!p?.id) continue;
            const m = String(p.id).match(/^Ref-(\d+)-PINV/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxPinv) maxPinv = n;
            }
          }
        }
        const minSafePinv = maxPinv + 1;
        if (typeof current.pinv !== 'number' || isNaN(current.pinv) || current.pinv < minSafePinv) {
          current.pinv = minSafePinv;
          changed = true;
        }
      }

      // 2. Outbound Invoices, Letters & Shipping Orders: ONLY audits 'ref'
      if (!triggerTable || triggerTable === 'invoices' || triggerTable === 'letters' || triggerTable === 'shipping_orders') {
        const [invRes, letRes, shpRes] = await Promise.all([
          getCollection<any>('invoices'),
          getCollection<any>('letters'),
          getCollection<any>('shipping_orders'),
        ]);
        let maxRef = 0;
        if (invRes.success && Array.isArray(invRes.data)) {
          for (const inv of invRes.data) {
            if (!inv?.id) continue;
            const idStr = String(inv.id);
            if (!idStr.includes('PINV')) {
              const m = idStr.match(/^Ref-(\d+)/i);
              if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxRef) maxRef = n;
              }
            }
          }
        }
        if (letRes.success && Array.isArray(letRes.data)) {
          for (const l of letRes.data) {
            if (!l?.id) continue;
            const m = String(l.id).match(/^Ref-(\d+)/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxRef) maxRef = n;
            }
          }
        }
        if (shpRes.success && Array.isArray(shpRes.data)) {
          for (const s of shpRes.data) {
            if (!s?.id) continue;
            const m = String(s.id).match(/^Ref-(\d+)/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxRef) maxRef = n;
            }
          }
        }
        const minSafeRef = maxRef + 1;
        if (typeof current.ref !== 'number' || isNaN(current.ref) || current.ref < minSafeRef) {
          current.ref = minSafeRef;
          changed = true;
        }
      }

      // 3. Work Orders & Serial Numbers: ONLY audits 'wo' & 'sn'
      if (!triggerTable || triggerTable === 'work_orders') {
        const woRes = await getCollection<any>('work_orders');
        let maxWo = 0;
        let maxSn = 0;
        if (woRes.success && Array.isArray(woRes.data)) {
          for (const wo of woRes.data) {
            if (wo?.id) {
              const m = String(wo.id).match(/^WO-\d+-(\d+)/i);
              if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxWo) maxWo = n;
              }
            }
            if (Array.isArray(wo?.items)) {
              for (const item of wo.items) {
                if (item?.serialNumber) {
                  const snStr = String(item.serialNumber);
                  const m = snStr.match(/^SN-\d+-(\d+)/i);
                  const n = m ? parseInt(m[1], 10) : parseInt(snStr, 10);
                  if (!isNaN(n) && n > maxSn) maxSn = n;
                }
              }
            }
          }
        }
        const minSafeWo = maxWo + 1;
        const minSafeSn = maxSn + 1;
        if (typeof current.wo !== 'number' || isNaN(current.wo) || current.wo < minSafeWo) {
          current.wo = minSafeWo;
          changed = true;
        }
        if (typeof current.sn !== 'number' || isNaN(current.sn) || current.sn < minSafeSn) {
          current.sn = minSafeSn;
          changed = true;
        }
      }

      if (changed) {
        idCountersRef.current = current;
        setIdCounters(current);
      }
    } catch (err) {
      console.error('[SettingsContext] Failed to audit counters:', err);
    }
  }, [setIdCounters]);

  // Keep ref updated when DB changes (from SSE or initial load)
  React.useEffect(() => {
    if (!idCounters) return;
    idCountersRef.current = { ...idCounters };
  }, [idCounters]);

  // Run initial full audit on mount and listen to table-specific db changes
  React.useEffect(() => {
    auditAndHealCounters();

    const handleDbChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const table = customEvent.detail;
      if (['invoices', 'letters', 'work_orders', 'purchase_invoices'].includes(table)) {
        auditAndHealCounters(table);
      }
    };
    window.addEventListener('shams-db-change', handleDbChange);
    return () => window.removeEventListener('shams-db-change', handleDbChange);
  }, [auditAndHealCounters]);

  const currentYear = new Date().getFullYear();

  const generateId = (type: string, customerName = '', extraText = '', yearOverride?: number) => {
    let actualType = type;
    if (type === 'invP' || type === 'invF' || type === 'invTech' || type === 'إنتاجية' || type === 'shp' || type === 'letter') actualType = 'ref';
    if (type === 'pinv') actualType = 'pinv';
    
    let seq = idCountersRef.current[actualType];
    if (typeof seq !== 'number' || isNaN(seq) || seq < 1) {
      seq = 1;
    }
    
    const newCounters = { ...idCountersRef.current, [actualType]: seq + 1 };
    
    // Update ref for immediate next use
    idCountersRef.current = newCounters;
    // Persist to database
    setIdCounters(newCounters);
    
    const pad = seq.toString().padStart(3, '0');
    const safeCustomerClean = customerName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const safeCustomer = safeCustomerClean ? '-' + safeCustomerClean + '-' : '-';
    const targetYear = yearOverride || currentYear;

    if (type === 'pinv') {
      const safeSupplierClean = customerName.replace(/[\/\\:*?"<>|]/g, '').trim();
      if (safeSupplierClean) {
        return `Ref-${pad}-PINV-${targetYear}-${safeSupplierClean}`.replace(/--+/g, '-');
      }
      return `Ref-${pad}-PINV-${targetYear}`;
    }
    
    if (type === 'letter') {
       const safeExtraClean = extraText.replace(/[\/\\:*?"<>|]/g, '').trim();
       return `Ref-${pad}-${safeCustomerClean || 'بدون_اسم'}-${safeExtraClean || 'رسالة'}-${targetYear}`.replace(/--+/g, '-');
    }
    
    if (type === 'invP') return `Ref-${pad}-INV-P${safeCustomer}${targetYear}`;
    if (type === 'invF') return `Ref-${pad}-INV-F${safeCustomer}${targetYear}`;
    if (type === 'invTech' || type === 'إنتاجية') return `Ref-${pad}-INV-T${safeCustomer}${targetYear}`;
    if (type === 'shp') return `Ref-${pad}-SHP${safeCustomer}${targetYear}`;
    
    const pad4 = seq.toString().padStart(4, '0');
    if (type === 'wo') return `WO-${targetYear}-${pad4}`;
    if (type === 'sn') return `SN-${targetYear}-${pad4}`;
    return pad4;
  };

  /** توليد المعرف ذرياً ومباشرة من الخادم الرئيسي مع التحقق من الاتصال */
  const generateIdAsync = async (type: string, customerName = '', extraText = '', yearOverride?: number): Promise<string> => {
    try {
      const res = await requestNextId(type, customerName, extraText, yearOverride);
      if (res.success && res.data) {
        return res.data;
      }
      if (import.meta.env?.DEV) {
        console.warn('[SettingsContext] تم التوليد عبر الوضع التطويري المحلي الاحتياطي:', res.error);
        return generateId(type, customerName, extraText, yearOverride);
      }
      throw new Error(res.error || 'تعذر حجز الرقم الإشاري من الجهاز الرئيسي. يرجى التحقق من الشبكة.');
    } catch (err: any) {
      if (import.meta.env?.DEV) {
        console.warn('[SettingsContext] DEV fallback for ID generation on error:', err.message);
        return generateId(type, customerName, extraText, yearOverride);
      }
      throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ appSettings, setAppSettings, idCounters, setIdCounters, idCountersRef, generateId, generateIdAsync, auditAndHealCounters }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
