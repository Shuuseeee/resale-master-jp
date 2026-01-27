// scripts/fix-image-urls.ts
// 修复数据库中的图片 URL，将公共 URL 转换为签名 URL

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixImageUrls() {
  console.log('开始修复图片 URL...');

  // 获取所有有图片的交易记录
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .neq('image_url', '');

  if (error) {
    console.error('获取交易记录失败:', error);
    return;
  }

  console.log(`找到 ${transactions?.length || 0} 条有图片的记录`);

  let successCount = 0;
  let errorCount = 0;

  for (const transaction of transactions || []) {
    try {
      // 检查是否已经是签名 URL
      if (transaction.image_url.includes('/object/sign/')) {
        console.log(`跳过已是签名 URL: ${transaction.id}`);
        continue;
      }

      // 从 URL 中提取文件名
      const urlParts = transaction.image_url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];

      // 生成新的签名 URL（有效期1年）
      const { data: signedData, error: signedError } = await supabase.storage
        .from('receipts')
        .createSignedUrl(fileName, 31536000);

      if (signedError) {
        console.error(`生成签名 URL 失败 (${transaction.id}):`, signedError);
        errorCount++;
        continue;
      }

      // 更新数据库记录
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ image_url: signedData.signedUrl })
        .eq('id', transaction.id);

      if (updateError) {
        console.error(`更新记录失败 (${transaction.id}):`, updateError);
        errorCount++;
        continue;
      }

      console.log(`✓ 已更新: ${transaction.id}`);
      successCount++;
    } catch (err) {
      console.error(`处理记录失败 (${transaction.id}):`, err);
      errorCount++;
    }
  }

  console.log('\n修复完成！');
  console.log(`成功: ${successCount} 条`);
  console.log(`失败: ${errorCount} 条`);
}

fixImageUrls().catch(console.error);