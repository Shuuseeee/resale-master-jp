import { useState, useEffect } from 'react';
import { fetchBuybackPrices, getBestPrice } from '@/lib/api/kaitorix';
import { loadKaitorixConfig } from '@/lib/kaitorix-config';

interface Transaction {
  id: string;
  jan_code?: string | null;
  unit_price?: number | null;
  purchase_price_total: number;
  quantity: number;
}

interface BuybackInfo {
  maxPrice: number;
  maxStore: string;
  expectedProfit: number;
  loading: boolean;
}

export function useKaitorixPrices(
  transactions: Transaction[]
): Map<string, BuybackInfo> {
  const [buybackMap, setBuybackMap] = useState<Map<string, BuybackInfo>>(
    new Map()
  );

  useEffect(() => {
    const config = loadKaitorixConfig();

    if (!config.enabled || config.enabledStores.length === 0) {
      setBuybackMap(new Map());
      return;
    }

    // Collect unique JAN codes
    const janToTransactions = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (t.jan_code) {
        const list = janToTransactions.get(t.jan_code) || [];
        list.push(t);
        janToTransactions.set(t.jan_code, list);
      }
    });

    const uniqueJans = Array.from(janToTransactions.keys());

    if (uniqueJans.length === 0) {
      setBuybackMap(new Map());
      return;
    }

    // Set loading state
    const loadingMap = new Map<string, BuybackInfo>();
    transactions.forEach(t => {
      if (t.jan_code) {
        loadingMap.set(t.id, {
          maxPrice: 0,
          maxStore: '',
          expectedProfit: 0,
          loading: true,
        });
      }
    });
    setBuybackMap(loadingMap);

    // Fetch prices
    fetchBuybackPrices(uniqueJans).then(results => {
      const newMap = new Map<string, BuybackInfo>();

      janToTransactions.forEach((txList, jan) => {
        const result = results.get(jan);
        const bestPrice = result
          ? getBestPrice(result, config.enabledStores)
          : null;

        txList.forEach(tx => {
          if (bestPrice) {
            const costPerUnit =
              tx.unit_price ?? tx.purchase_price_total / tx.quantity;
            const expectedProfit = bestPrice.maxPrice - costPerUnit;

            newMap.set(tx.id, {
              maxPrice: bestPrice.maxPrice,
              maxStore: bestPrice.maxStore,
              expectedProfit,
              loading: false,
            });
          } else {
            newMap.set(tx.id, {
              maxPrice: 0,
              maxStore: '',
              expectedProfit: 0,
              loading: false,
            });
          }
        });
      });

      setBuybackMap(newMap);
    });
  }, [transactions]);

  return buybackMap;
}
