import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import type { PurchaseInvoice } from '../types';

interface PurchasesContextType {
  purchaseInvoices: PurchaseInvoice[];
  setPurchaseInvoices: (invoices: PurchaseInvoice[] | ((prev: PurchaseInvoice[]) => PurchaseInvoice[])) => void;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(undefined);

export const PurchasesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchaseInvoices, setPurchaseInvoices] = useDatabaseCollection<PurchaseInvoice>('purchase_invoices', []);

  return (
    <PurchasesContext.Provider value={{ purchaseInvoices, setPurchaseInvoices }}>
      {children}
    </PurchasesContext.Provider>
  );
};

export const usePurchases = () => {
  const context = useContext(PurchasesContext);
  if (context === undefined) {
    throw new Error('usePurchases must be used within a PurchasesProvider');
  }
  return context;
};
