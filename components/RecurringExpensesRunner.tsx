// components/RecurringExpensesRunner.tsx — 登录后每次打开应用补记一次到期的定期经费（lib/api/recurring-expenses.ts）
// 记入了新经费才主动让依赖经费的查询重拉；离线、库未升级（函数不存在）时静默跳过，下次打开再补。
'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { generateRecurringExpenses } from '@/lib/api/recurring-expenses';
import { queryKeysForTable } from '@/lib/queryInvalidation';

export default function RecurringExpensesRunner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || doneFor.current === user.id || !navigator.onLine) return;
    doneFor.current = user.id;
    generateRecurringExpenses()
      .then(n => {
        if (n === 0) return;
        for (const key of [...queryKeysForTable('supplies_costs'), 'recurring-expenses']) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      })
      .catch(err => console.warn('补记定期经费失败:', err));
  }, [user, queryClient]);

  return null;
}
