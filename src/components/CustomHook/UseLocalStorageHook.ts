import { useState, useEffect } from 'react';

export function useLocalStorageHook<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  useEffect(() => {
    setValue(JSON.parse(localStorage.getItem(key) || JSON.stringify(initialValue)));
  }, [key, initialValue]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}
