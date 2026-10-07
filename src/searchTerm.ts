/**
 * 搜尋字詞查詢工具
 * 執行：npx tsx src/searchTerm.ts --term STARTOWN
 * 執行：npx tsx src/searchTerm.ts --term STARTOWN --start 2026-08-01 --end 2026-08-31
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const term = get('--term');
  if (!term) {
    console.error('用法：npx tsx src/searchTerm.ts --term <關鍵字> [--start YYYY-MM-DD] [--end YYYY-MM-DD]');
    process.exit(1);
  }
  const start = get('--start') ?? '30daysAgo';
  const end   = get('--end')   ?? 'yesterday';
  return { term, start, end };
}

async function query(term: string, start: string, end: string) {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'searchTerm' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'search' },
      },
    },
    limit: 10000,
  });

  const termLower = term.toLowerCase();
  const matches = (res.rows ?? [])
    .map((r) => ({
      term:    r.dimensionValues?.[0]?.value ?? '',
      count:   parseInt(r.metricValues?.[0]?.value ?? '0'),
      users:   parseInt(r.metricValues?.[1]?.value ?? '0'),
    }))
    .filter((r) => r.term.toLowerCase().includes(termLower))
    .sort((a, b) => b.count - a.count);

  return matches;
}

async function main() {
  const { term, start, end } = parseArgs();
  const label = `${start === '30daysAgo' ? '近30天' : start} ～ ${end === 'yesterday' ? '昨天' : end}`;

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   GA4 搜尋字詞查詢                                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`  關鍵字：${term}`);
  console.log(`  時間範圍：${label}\n`);
  console.log('  正在查詢...\n');

  const matches = await query(term, start, end);

  if (matches.length === 0) {
    console.log(`  ❌ 查無包含「${term}」的搜尋字詞（此期間內）\n`);
    return;
  }

  const totalCount = matches.reduce((s, r) => s + r.count, 0);
  const totalUsers = matches.reduce((s, r) => s + r.users, 0);

  console.log(`  ✅ 找到 ${matches.length} 個相符的搜尋字詞\n`);
  console.log(`  ${'搜尋字詞'.padEnd(40)} ${'搜尋次數'.padStart(10)} ${'用戶數'.padStart(8)}`);
  console.log('  ' + '─'.repeat(62));

  matches.forEach((r, i) => {
    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}. `;
    const termStr = r.term.length > 38 ? r.term.slice(0, 37) + '…' : r.term.padEnd(40);
    console.log(`  ${rank} ${termStr} ${r.count.toLocaleString().padStart(8)} ${r.users.toLocaleString().padStart(8)}`);
  });

  console.log('  ' + '─'.repeat(62));
  console.log(`  ${'合計'.padEnd(43)} ${totalCount.toLocaleString().padStart(8)} ${totalUsers.toLocaleString().padStart(8)}\n`);
}

main().catch(console.error);
