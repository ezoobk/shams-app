import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import type { Supplier } from '../types';

interface SuppliersContextType {
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void;
}

const SuppliersContext = createContext<SuppliersContextType | undefined>(undefined);

export const SuppliersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [suppliers, setSuppliers] = useDatabaseCollection<Supplier>('suppliers', [
    { id: 'S1', name: 'شركة الحديد والصلب الليبية', phone: '0912345678', address: 'مصراتة', notes: 'مورد رئيسي لحديد الهياكل والصاج' },
    { id: 'S2', name: 'مؤسسة السلام للمحاور والمستلزمات', phone: '0923456789', address: 'طرابلس', notes: 'محاور وإطارات' }
  ]);

  return (
    <SuppliersContext.Provider value={{ suppliers, setSuppliers }}>
      {children}
    </SuppliersContext.Provider>
  );
};

export const useSuppliers = () => {
  const context = useContext(SuppliersContext);
  if (context === undefined) {
    throw new Error('useSuppliers must be used within a SuppliersProvider');
  }
  return context;
};
