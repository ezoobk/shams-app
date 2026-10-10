import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const readValue = () => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);
  const dataRef = useRef(storedValue);

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(dataRef.current) : value;
      setStoredValue(valueToStore);
      dataRef.current = valueToStore;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    dataRef.current = storedValue;
  }, [storedValue]);

  return [storedValue, setValue];
}
