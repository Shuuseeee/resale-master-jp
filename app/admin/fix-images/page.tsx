'use client';

import { useState } from 'react';
import { supabase, getSignedImageUrl } from '@/lib/supabase/client';
import { layout, heading, card, button } from '@/lib/theme';

export default function FixImagesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const fixImageUrls = async () => {
    setLoading(true);
    setResult('开始修复图片 URL...\n');

    try {
      // 获取所有有图片的交易记录
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '');

      if (error) {
        setResult(prev => prev + `\n❌ 获取交易记录失败: ${error.message}`);
        return;
      }

      setResult(prev => prev + `\n找到 ${transactions?.length || 0} 条有图片的记录\n`);

      let successCount = 0;
      let errorCount = 0;

      for (const transaction of transactions || []) {
        try {
          // 检查是否已经是签名 URL
          if (transaction.image_url.includes('/object/sign/')) {
            setResult(prev => prev + `\n⏭️  跳过已是签名 URL: ${transaction.id.substring(0, 8)}...`);
            continue;
          }

          // 从 URL 中提取文件名
          const urlParts = transaction.image_url.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];

          // 生成新的签名 URL
          const signedUrl = await getSignedImageUrl(fileName);

          // 更新数据库记录
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ image_url: signedUrl })
            .eq('id', transaction.id);

          if (updateError) {
            setResult(prev => prev + `\n❌ 更新失败 (${transaction.id.substring(0, 8)}...): ${updateError.message}`);
            errorCount++;
            continue;
          }

          setResult(prev => prev + `\n✅ 已更新: ${transaction.id.substring(0, 8)}...`);
          successCount++;
        } catch (err: any) {
          setResult(prev => prev + `\n❌ 处理失败 (${transaction.id.substring(0, 8)}...): ${err.message}`);
          errorCount++;
        }
      }

      setResult(prev => prev + `\n\n修复完成！\n成功: ${successCount} 条\n失败: ${errorCount} 条`);
    } catch (error: any) {
      setResult(prev => prev + `\n\n❌ 发生错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        <div className={layout.section}>
          <h1 className={heading.h1}>修复图片 URL</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            将数据库中的公共 URL 转换为签名 URL
          </p>
        </div>

        <div className={card.primary + ' p-6'}>
          <button
            onClick={fixImageUrls}
            disabled={loading}
            className={button.primary + ' mb-4'}
          >
            {loading ? '修复中...' : '开始修复'}
          </button>

          {result && (
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
