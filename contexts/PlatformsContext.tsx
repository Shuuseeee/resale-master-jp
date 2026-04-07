'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPurchasePlatforms, getSellingPlatforms } from '@/lib/api/platforms';
import type { PurchasePlatform, SellingPlatform } from '@/types/database.types';
import { useAuth } from '@/contexts/AuthContext';

interface PlatformsContextType {
  purchasePlatforms: PurchasePlatform[];
  sellingPlatforms: SellingPlatform[];
  refreshPlatforms: () => Promise<void>;
}

const PlatformsContext = createContext<PlatformsContextType | undefined>(undefined);

export function PlatformsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [purchasePlatforms, setPurchasePlatforms] = useState<PurchasePlatform[]>([]);
  const [sellingPlatforms, setSellingPlatforms] = useState<SellingPlatform[]>([]);

  const refreshPlatforms = useCallback(async () => {
    const [purchase, selling] = await Promise.all([
      getPurchasePlatforms(),
      getSellingPlatforms(),
    ]);
    setPurchasePlatforms(purchase);
    setSellingPlatforms(selling);
  }, []);

  useEffect(() => {
    if (user) refreshPlatforms();
  }, [user, refreshPlatforms]);

  return (
    <PlatformsContext.Provider value={{ purchasePlatforms, sellingPlatforms, refreshPlatforms }}>
      {children}
    </PlatformsContext.Provider>
  );
}

export function usePlatforms() {
  const context = useContext(PlatformsContext);
  if (!context) throw new Error('usePlatforms must be used within PlatformsProvider');
  return context;
}
