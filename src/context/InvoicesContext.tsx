import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';

interface InvoicesContextType {
  invoices: any[];
  setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
  deletedInvoices: any[];
  setDeletedInvoices: React.Dispatch<React.SetStateAction<any[]>>;
}

const InvoicesContext = createContext<InvoicesContextType | undefined>(undefined);

export const InvoicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [invoices, setInvoices] = useDatabaseCollection<any[]>('invoices', []);
  const [deletedInvoices, setDeletedInvoices] = useDatabaseCollection<any[]>('deleted_invoices', []);

  return (
    <InvoicesContext.Provider value={{ invoices, setInvoices, deletedInvoices, setDeletedInvoices }}>
      {children}
    </InvoicesContext.Provider>
  );
};

export const useInvoices = () => {
  const context = useContext(InvoicesContext);
  if (context === undefined) {
    throw new Error('useInvoices must be used within a InvoicesProvider');
  }
  return context;
};
