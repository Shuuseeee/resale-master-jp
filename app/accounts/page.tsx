// app/accounts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { BankAccount } from '@/lib/api/financial';
import { formatCurrency } from '@/lib/financial/calculator';
import Link from 'next/link';
import { layout, heading, card, button, badge, input } from '@/lib/theme';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<number>(0);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('加载账户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setEditBalance(account.current_balance);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBalance(0);
  };

  const saveBalance = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ current_balance: editBalance })
        .eq('id', id);

      if (error) throw error;

      await loadAccounts();
      setEditingId(null);
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      await loadAccounts();
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking':
        return '普通账户';
      case 'savings':
        return '储蓄账户';
      case 'wallet':
        return '电子钱包';
      default:
        return type;
    }
  };

  const totalBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0);

  if (loading) {
    return (
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className="relative max-w-6xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className={layout.section}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={heading.h1 + ' mb-2'}>账户管理</h1>
              <p className="text-gray-600 dark:text-gray-400">管理您的银行账户和余额</p>
            </div>
            <Link
              href="/accounts/add"
              className={button.primary + ' flex items-center gap-2'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加账户
            </Link>
          </div>
        </div>

        {/* 总余额卡片 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-8 mb-8 text-white shadow-2xl">
          <div className="text-sm opacity-90 mb-2">总余额</div>
          <div className="text-5xl font-bold mb-4">{formatCurrency(totalBalance)}</div>
          <div className="text-sm opacity-75">
            {accounts.filter(a => a.is_active).length} 个活跃账户
          </div>
        </div>

        {/* 账户列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
          {accounts.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400 text-lg">暂无账户</p>
              <Link
                href="/accounts/add"
                className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                添加第一个账户
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      账户名称
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      类型
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      当前余额
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-gray-900 dark:text-white font-medium">{account.name}</div>
                        {account.notes && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{account.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {getAccountTypeLabel(account.account_type)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === account.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              value={editBalance}
                              onChange={(e) => setEditBalance(parseFloat(e.target.value) || 0)}
                              step="0.01"
                              className="w-32 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => saveBalance(account.id)}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-900 dark:text-white font-mono text-lg">
                              {formatCurrency(account.current_balance)}
                            </span>
                            <button
                              onClick={() => startEdit(account)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="编辑余额"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleActive(account.id, account.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            account.is_active
                              ? 'bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-green-500/30'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {account.is_active ? '启用' : '禁用'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/accounts/${account.id}/edit`}
                          className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          编辑
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
