// 临时迁移脚本
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nionbpkoktgejkqfmlio.supabase.co';
const supabaseServiceKey = 'sbp_db2e5c9ea54836111e44d2992b6bd99a28b2afbf';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 开始执行数据库迁移...\n');

    // 读取迁移脚本
    const sql = fs.readFileSync('/Users/xr/Projects/resale-master-jp/supabase/migrations/20260131_complete_migration.sql', 'utf8');

    // 执行 SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // 如果 exec_sql 函数不存在，尝试直接执行
      console.log('⚠️  exec_sql 函数不存在，尝试分段执行...\n');

      // 分段执行 SQL
      const statements = sql.split(';').filter(s => s.trim());

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith('--')) continue;

        console.log(`执行语句 ${i + 1}/${statements.length}...`);

        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });

        if (stmtError) {
          console.error(`❌ 语句执行失败:`, stmtError.message);
          throw stmtError;
        }
      }
    }

    console.log('\n✅ 迁移执行成功！');

    // 查询迁移结果
    const { data: result, error: queryError } = await supabase
      .from('sales_records')
      .select('*', { count: 'exact', head: true })
      .eq('notes', '从旧数据迁移，请补充销售日期');

    if (!queryError && result) {
      console.log(`\n📊 迁移了 ${result.count || 0} 条旧记录`);
    }

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
