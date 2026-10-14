// components/BuybackStoresSync.tsx — 登录后把「买取价格检查」勾选的店与数据库同步一次（user_preferences.buyback_stores）
// 数据库为准：库里有就覆盖浏览器里的副本（换设备也一样）；库里还没有、而这台浏览器保存过设置时，把它传上去（升级前的设置不丢）。
// 各页面在挂载时读一次设置，所以别的设备改过的设置在下次打开页面时生效。离线、库未升级时静默跳过。
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getBuybackStores, saveBuybackStores } from '@/lib/api/user-preferences';
import { hasStoredKaitorixConfig, loadKaitorixConfig, normalizeStoreName, saveKaitorixConfig } from '@/lib/kaitorix-config';

export default function BuybackStoresSync() {
  const { user } = useAuth();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || doneFor.current === user.id || !navigator.onLine) return;
    doneFor.current = user.id;
    getBuybackStores()
      .then(remote => {
        if (remote === undefined) return;
        const local = loadKaitorixConfig();
        if (remote === null) {
          if (hasStoredKaitorixConfig()) saveBuybackStores(local.enabledStores);
          return;
        }
        const stores = [...new Set(remote.map(normalizeStoreName))];
        const same = stores.length === local.enabledStores.length && stores.every(s => local.enabledStores.includes(s));
        if (!same) saveKaitorixConfig({ ...local, enabledStores: stores });
      })
      .catch(err => console.warn('同步买取店设置失败:', err));
  }, [user]);

  return null;
}
