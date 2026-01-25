'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DiagnosePage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function diagnose() {
      console.log('=== RLS 诊断开始 ===');

      // 1. 检查当前用户
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('当前用户:', user);
      console.log('用户错误:', userError);

      // 2. 检查会话
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('当前会话:', session);
      console.log('会话错误:', sessionError);

      // 3. 直接查询 transactions 表
      const { data: transactions, error: transError, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' });

      console.log('Transactions 查询结果:', transactions);
      console.log('Transactions 数量:', count);
      console.log('Transactions 错误:', transError);

      // 4. 查询 bank_accounts 表
      const { data: accounts, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('*');

      console.log('Bank accounts 查询结果:', accounts);
      console.log('Bank accounts 错误:', accountsError);

      // 5. 尝试使用 RPC 调用检查 auth.uid()
      const { data: uidCheck, error: uidError } = await supabase
        .rpc('auth.uid' as any);

      console.log('auth.uid() 检查:', uidCheck);
      console.log('auth.uid() 错误:', uidError);

      setResults({
        user: { data: user, error: userError },
        session: { data: session, error: sessionError },
        transactions: { data: transactions, count, error: transError },
        accounts: { data: accounts, error: accountsError },
        uidCheck: { data: uidCheck, error: uidError },
      });

      setLoading(false);
      console.log('=== RLS 诊断结束 ===');
    }

    diagnose();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">RLS 诊断中...</h1>
        <p>请打开浏览器控制台查看详细信息（F12 → Console）</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">RLS 诊断结果</h1>
      <p className="mb-4 text-red-600 font-semibold">
        ⚠️ 请打开浏览器控制台（F12 → Console）查看完整的诊断信息
      </p>

      <div className="space-y-6">
        <div className="border p-4 rounded bg-white shadow">
          <h2 className="font-semibold text-lg mb-2">1. 当前用户信息</h2>
          <div className="bg-gray-100 p-3 rounded">
            <p><strong>用户 ID:</strong> {results.user?.data?.id || '未登录'}</p>
            <p><strong>邮箱:</strong> {results.user?.data?.email || '未登录'}</p>
            <p><strong>错误:</strong> {results.user?.error ? JSON.stringify(results.user.error) : '无'}</p>
          </div>
        </div>

        <div className="border p-4 rounded bg-white shadow">
          <h2 className="font-semibold text-lg mb-2">2. 会话信息</h2>
          <div className="bg-gray-100 p-3 rounded">
            <p><strong>会话存在:</strong> {results.session?.data ? '是' : '否'}</p>
            <p><strong>Access Token:</strong> {results.session?.data?.access_token ? '存在' : '不存在'}</p>
          </div>
        </div>

        <div className="border p-4 rounded bg-white shadow">
          <h2 className="font-semibold text-lg mb-2">3. Transactions 查询结果</h2>
          <div className="bg-gray-100 p-3 rounded">
            <p><strong>查询到的记录数:</strong> {results.transactions?.count || 0}</p>
            <p><strong>是否有错误:</strong> {results.transactions?.error ? '是' : '否'}</p>
            {results.transactions?.data && results.transactions.data.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-red-600">⚠️ 查询到了 {results.transactions.data.length} 条记录</p>
                <p className="text-sm">第一条记录的 user_id: {results.transactions.data[0]?.user_id}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border p-4 rounded bg-white shadow">
          <h2 className="font-semibold text-lg mb-2">4. Bank Accounts 查询结果</h2>
          <div className="bg-gray-100 p-3 rounded">
            <p><strong>查询到的记录数:</strong> {results.accounts?.data?.length || 0}</p>
            <p><strong>是否有错误:</strong> {results.accounts?.error ? '是' : '否'}</p>
          </div>
        </div>

        <div className="border p-4 rounded bg-red-50 shadow">
          <h2 className="font-semibold text-lg mb-2 text-red-700">诊断结论</h2>
          <div className="space-y-2">
            {results.user?.data?.id ? (
              <p className="text-green-600">✅ 用户已登录</p>
            ) : (
              <p className="text-red-600">❌ 用户未登录</p>
            )}

            {results.transactions?.count > 0 ? (
              <p className="text-red-600 font-bold">
                ❌ RLS 未生效！查询到了 {results.transactions.count} 条交易记录
              </p>
            ) : (
              <p className="text-green-600">✅ RLS 可能已生效（没有查询到记录）</p>
            )}

            {results.user?.data?.id && results.transactions?.count > 0 && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                <p className="font-bold text-red-800">严重问题：</p>
                <p className="text-sm">用户已登录但仍能看到所有数据，RLS 策略没有生效！</p>
                <p className="text-sm mt-2">
                  当前用户 ID: {results.user.data.id}<br/>
                  第一条记录的 user_id: {results.transactions.data?.[0]?.user_id}
                </p>
                {results.user.data.id !== results.transactions.data?.[0]?.user_id && (
                  <p className="text-sm mt-2 font-bold text-red-900">
                    ⚠️ 用户 ID 不匹配！这证明 RLS 没有工作！
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
