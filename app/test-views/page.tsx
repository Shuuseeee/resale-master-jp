'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function TestViewsPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testViews() {
      console.log('Testing database views...');

      // 测试 financial_water_level 视图
      const { data: waterLevel, error: waterError } = await supabase
        .from('financial_water_level')
        .select('*')
        .single();

      console.log('Water level data:', waterLevel);
      console.log('Water level error:', waterError);

      // 测试 upcoming_payments 视图
      const { data: payments, error: paymentsError } = await supabase
        .from('upcoming_payments')
        .select('*');

      console.log('Upcoming payments data:', payments);
      console.log('Upcoming payments error:', paymentsError);

      // 测试 pending_points 视图
      const { data: points, error: pointsError } = await supabase
        .from('pending_points')
        .select('*');

      console.log('Pending points data:', points);
      console.log('Pending points error:', pointsError);

      // 测试基础表查询
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('count');

      console.log('Transactions count:', transactions);
      console.log('Transactions error:', transError);

      setResults({
        waterLevel: { data: waterLevel, error: waterError },
        payments: { data: payments, error: paymentsError },
        points: { data: points, error: pointsError },
        transactions: { data: transactions, error: transError },
      });

      setLoading(false);
    }

    testViews();
  }, []);

  if (loading) {
    return <div className="p-8">Testing views...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Database Views Test Results</h1>

      <div className="space-y-6">
        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Water Level View</h2>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(results.waterLevel, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Upcoming Payments View</h2>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(results.payments, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Pending Points View</h2>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(results.points, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Transactions Table (Direct Query)</h2>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(results.transactions, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
