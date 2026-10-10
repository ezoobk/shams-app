import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { Customer } from '../types';

interface CustomersContextType {
  customers: Customer[];
  setCustomers: (customers: Customer[] | ((prev: Customer[]) => Customer[])) => void;
}

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

export const CustomersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useDatabaseCollection<Customer[]>('customers', [
    { id: 'C1', name: 'شركة الإنشاءات الحديثة', phone: '0910000000', notes: 'عميل دائم' },
    { id: 'C2', name: 'مجموعة النقل السريع', phone: '0920000000', notes: 'دفع نقدي' }
  ]);

  return (
    <CustomersContext.Provider value={{ customers, setCustomers }}>
      {children}
    </CustomersContext.Provider>
  );
};

export const useCustomers = () => {
  const context = useContext(CustomersContext);
  if (context === undefined) {
    throw new Error('useCustomers must be used within a CustomersProvider');
  }
  return context;
};
