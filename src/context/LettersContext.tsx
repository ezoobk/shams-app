import React, { createContext, useContext } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type { Letter } from '../types';

interface LettersContextType {
  letters: Letter[];
  setLetters: (letters: Letter[] | ((prev: Letter[]) => Letter[])) => void;
}

const LettersContext = createContext<LettersContextType | undefined>(undefined);

export const LettersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [letters, setLetters] = useDatabaseCollection<Letter[]>('letters', []);

  return (
    <LettersContext.Provider value={{ letters, setLetters }}>
      {children}
    </LettersContext.Provider>
  );
};

export const useLetters = () => {
  const context = useContext(LettersContext);
  if (context === undefined) {
    throw new Error('useLetters must be used within a LettersProvider');
  }
  return context;
};
