import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';

interface ShippingOrdersContextType {
  shippingOrders: any[];
  setShippingOrders: React.Dispatch<React.SetStateAction<any[]>>;
}

const ShippingOrdersContext = createContext<ShippingOrdersContextType | undefined>(undefined);

export const ShippingOrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shippingOrders, setShippingOrders] = useDatabaseCollection<any[]>('shipping_orders', []);

  return (
    <ShippingOrdersContext.Provider value={{ shippingOrders, setShippingOrders }}>
      {children}
    </ShippingOrdersContext.Provider>
  );
};

export const useShippingOrders = () => {
  const context = useContext(ShippingOrdersContext);
  if (context === undefined) {
    throw new Error('useShippingOrders must be used within a ShippingOrdersProvider');
  }
  return context;
};
