import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';

interface WorkOrdersContextType {
  workOrders: any[];
  setWorkOrders: React.Dispatch<React.SetStateAction<any[]>>;
}

const WorkOrdersContext = createContext<WorkOrdersContextType | undefined>(undefined);

export const WorkOrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workOrders, setWorkOrders] = useDatabaseCollection<any[]>('work_orders', []);

  return (
    <WorkOrdersContext.Provider value={{ workOrders, setWorkOrders }}>
      {children}
    </WorkOrdersContext.Provider>
  );
};

export const useWorkOrders = () => {
  const context = useContext(WorkOrdersContext);
  if (context === undefined) {
    throw new Error('useWorkOrders must be used within a WorkOrdersProvider');
  }
  return context;
};
