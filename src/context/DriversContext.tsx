import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { Driver } from '../types';

interface DriversContextType {
  drivers: Driver[];
  setDrivers: (drivers: Driver[] | ((prev: Driver[]) => Driver[])) => void;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

export const DriversProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drivers, setDrivers] = useDatabaseCollection<Driver[]>('drivers', []);

  return (
    <DriversContext.Provider value={{ drivers, setDrivers }}>
      {children}
    </DriversContext.Provider>
  );
};

export const useDrivers = () => {
  const context = useContext(DriversContext);
  if (context === undefined) {
    throw new Error('useDrivers must be used within a DriversProvider');
  }
  return context;
};
