import React, { createContext, useContext, useRef } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { AppSettings } from '../types';

interface SettingsContextType {
  appSettings: AppSettings;
  setAppSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  idCountersRef: React.MutableRefObject<any>;
  generateId: (type: string, customerName?: string, extraText?: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

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
    outboundLogPath: null
  });

  const [idCounters, setIdCounters] = useDatabaseObject('shams_idCounters', { inv: 1, wo: 1, sn: 1, ref: 1 });
  
  // We sync the state to a ref for synchronous access in generateId
  const idCountersRef = useRef(idCounters);
  
  // Keep ref updated when DB changes (from SSE or initial load)
  React.useEffect(() => {
    if (!idCounters.ref) idCounters.ref = (idCounters.inv || 1);
    idCountersRef.current = idCounters;
  }, [idCounters]);

  const currentYear = new Date().getFullYear();

  const generateId = (type: string, customerName = '', extraText = '') => {
    let actualType = type;
    if (type === 'invP' || type === 'invF' || type === 'shp' || type === 'letter') actualType = 'ref';
    
    if (typeof idCountersRef.current[actualType] !== 'number' || isNaN(idCountersRef.current[actualType])) {
      idCountersRef.current[actualType] = 1;
    }
    
    const seq = idCountersRef.current[actualType];
    const newCounters = { ...idCountersRef.current, [actualType]: seq + 1 };
    
    // Update ref for immediate next use
    idCountersRef.current = newCounters;
    // Persist to database
    setIdCounters(newCounters);
    
    const pad = seq.toString().padStart(3, '0');
    const safeCustomerClean = customerName.replace(/[\/\\:*?"<>|]/g, '').trim();
    const safeCustomer = safeCustomerClean ? '-' + safeCustomerClean + '-' : '-';
    
    if (type === 'letter') {
       const safeExtraClean = extraText.replace(/[\/\\:*?"<>|]/g, '').trim();
       return `Ref-${pad}-${safeCustomerClean || 'بدون_اسم'}-${safeExtraClean || 'رسالة'}-${currentYear}`.replace(/--+/g, '-');
    }
    
    if (type === 'invP') return `Ref-${pad}-INV-P${safeCustomer}${currentYear}`;
    if (type === 'invF') return `Ref-${pad}-INV-F${safeCustomer}${currentYear}`;
    if (type === 'shp') return `Ref-${pad}-SHP${safeCustomer}${currentYear}`;
    
    const pad4 = seq.toString().padStart(4, '0');
    if (type === 'wo') return `WO-${currentYear}-${pad4}`;
    if (type === 'sn') return `SN-${currentYear}-${pad4}`;
    return pad4;
  };

  return (
    <SettingsContext.Provider value={{ appSettings, setAppSettings, idCountersRef, generateId }}>
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
