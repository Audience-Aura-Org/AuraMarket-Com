import { useEffect, useState } from 'react';

/**
 * useHydration
 * Returns true when the component has hydrated and Zustand persist stores are ready
 */
export const useHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
};
