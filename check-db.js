import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://nvwmogsgkbllkxebvzcg.supabase.co',
    '[REMOVED_SUPABASE_KEY]'
);

async function checkData() {
    console.log('=== 检查数据库中的虫洞数据 ===\n');
    
    const { data, error } = await supabase
        .from('WormholeRecord')
        .select('*')
        .eq('isExpired', false);
    
    if (error) {
        console.error('查询失败:', error);
        return;
    }
    
    console.log(`找到 ${data.length} 条记录:\n`);
    
    data.forEach((record, i) => {
        console.log(`记录 ${i + 1}:`);
        console.log('  ID:', record.id);
        console.log('  fromSystemName:', record.fromSystemName);
        console.log('  toSystemName:', record.toSystemName);
        console.log('  fromSystemId:', record.fromSystemId);
        console.log('  toSystemId:', record.toSystemId);
        console.log('  size:', record.size);
        console.log('  source:', record.source);
        console.log('  createdBy:', record.createdBy);
        console.log('');
    });
}

checkData();
