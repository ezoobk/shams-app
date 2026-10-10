import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { MasterMaterial } from '../types';

interface MaterialsContextType {
  masterMaterials: MasterMaterial[];
  setMasterMaterials: React.Dispatch<React.SetStateAction<MasterMaterial[]>>;
  worksOf: any[];
  setWorksOf: React.Dispatch<React.SetStateAction<any[]>>;
  masterItems: any[];
  setMasterItems: React.Dispatch<React.SetStateAction<any[]>>;
}

const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);

export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterMaterials, setMasterMaterials] = useDatabaseCollection<MasterMaterial[]>('master_materials', [
    { id: 1, name: 'عوارض حديد', shortName: 'عوارض', defaultPrice: 1650.0, unit: 'قطعة' },
    { id: 2, name: 'طلاء حراري', shortName: 'طلاء', defaultPrice: 45.0, unit: 'لتر' },
    { id: 3, name: 'لحام', shortName: 'لحام', defaultPrice: 15.0, unit: 'كجم' }
  ]);
  const [worksOf, setWorksOf] = useDatabaseCollection<any[]>('works_of', [
    { id: 'W1', name: 'الهيكل المعدني' },
    { id: 'W2', name: 'أعمال الحدادة' },
    { id: 'W3', name: 'أعمال التشطيب' }
  ]);
  const [masterItems, setMasterItems] = useDatabaseCollection<any[]>('master_items', [
    { id: 'I1', worksOfId: 'W1', name: 'تصنيع الشاصية' },
    { id: 'I2', worksOfId: 'W1', name: 'القاعدة' },
    { id: 'I3', worksOfId: 'W2', name: 'الأبواب' }
  ]);

  return (
    <MaterialsContext.Provider value={{ masterMaterials, setMasterMaterials, worksOf, setWorksOf, masterItems, setMasterItems }}>
      {children}
    </MaterialsContext.Provider>
  );
};

export const useMaterials = () => {
  const context = useContext(MaterialsContext);
  if (context === undefined) {
    throw new Error('useMaterials must be used within a MaterialsProvider');
  }
  return context;
};
