import React, { createContext, useContext, useState } from 'react';

interface PrintContextType {
  printData: any;
  setPrintData: React.Dispatch<React.SetStateAction<any>>;
}

const PrintContext = createContext<PrintContextType | undefined>(undefined);

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [printData, setPrintData] = useState<any>(null);

  return (
    <PrintContext.Provider value={{ printData, setPrintData }}>
      {children}
    </PrintContext.Provider>
  );
};

export const usePrint = () => {
  const context = useContext(PrintContext);
  if (context === undefined) {
    throw new Error('usePrint must be used within a PrintProvider');
  }
  return context;
};
