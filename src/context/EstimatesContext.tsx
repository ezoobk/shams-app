import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';

interface EstimatesContextType {
  estimates: any[];
  setEstimates: React.Dispatch<React.SetStateAction<any[]>>;
  estimateCategories: any[];
  setEstimateCategories: React.Dispatch<React.SetStateAction<any[]>>;
  cart: any[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  editingEstimate: any;
  setEditingEstimate: React.Dispatch<React.SetStateAction<any>>;
  editingContext: any;
  setEditingContext: React.Dispatch<React.SetStateAction<any>>;
  calculatorDraftRef: React.MutableRefObject<any>;
}

const EstimatesContext = createContext<EstimatesContextType | undefined>(undefined);

export const EstimatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estimates, setEstimates] = useDatabaseCollection<any[]>('estimates', []);
  const [estimateCategories, setEstimateCategories] = useDatabaseCollection<any[]>('estimate_categories', [
    { id: 'cat1', name: 'مقطورات سكنية' },
    { id: 'cat2', name: 'مكاتب إدارية' },
    { id: 'cat3', name: 'مخازن' },
  ]);
  const [cart, setCart] = useDatabaseObject<any[]>('shams_cart', []);
  const [editingEstimate, setEditingEstimate] = React.useState<any>(null);
  const [editingContext, setEditingContext] = React.useState<any>(null);
  const calculatorDraftRef = React.useRef<any>(null);

  return (
    <EstimatesContext.Provider value={{ 
      estimates, setEstimates, 
      estimateCategories, setEstimateCategories, 
      cart, setCart,
      editingEstimate, setEditingEstimate,
      editingContext, setEditingContext,
      calculatorDraftRef
    }}>
      {children}
    </EstimatesContext.Provider>
  );
};

export const useEstimates = () => {
  const context = useContext(EstimatesContext);
  if (context === undefined) {
    throw new Error('useEstimates must be used within a EstimatesProvider');
  }
  return context;
};
