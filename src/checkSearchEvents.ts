/**
 * 檢查站內搜尋相關事件與參數
 * 執行：npx tsx src/checkSearchEvents.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

async function checkEventNames() {
  console.log('【1】查所有含 search 的 event name（近30天）\n');
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'CONTAINS', value: 'search', caseSensitive: false },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 50,
  });

  if (!res.rows?.length) {
    console.log('  ❌ 查無任何含 search 的事件\n');
  } else {
    console.log(`  ${'事件名稱'.padEnd(45)} ${'次數'.padStart(10)}`);
    console.log('  ' + '─'.repeat(58));
    res.rows.forEach((r) => {
      const name  = r.dimensionValues?.[0]?.value ?? '';
      const count = parseInt(r.metricValues?.[0]?.value ?? '0');
      console.log(`  ${name.padEnd(45)} ${count.toLocaleString().padStart(10)}`);
    });
    console.log();
  }
  return res.rows ?? [];
}

async function checkViewSearchResults() {
  console.log('【2】view_search_results 事件 — 查有無 result_count 自訂參數\n');

  // 嘗試抓 customEvent:result_count 維度
  try {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [
        { name: 'eventName' },
        { name: 'customEvent:result_count' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'view_search_results' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    });

    if (!res.rows?.length) {
      console.log('  ⚠ view_search_results 事件存在，但 result_count 參數為空（未埋）\n');
    } else {
      console.log(`  ${'result_count 值'.padEnd(20)} ${'次數'.padStart(10)}`);
      console.log('  ' + '─'.repeat(33));
      res.rows.forEach((r) => {
        const val   = r.dimensionValues?.[1]?.value ?? '(not set)';
        const count = parseInt(r.metricValues?.[0]?.value ?? '0');
        const flag  = val === '0' ? '  ← 零結果！' : '';
        console.log(`  ${val.padEnd(20)} ${count.toLocaleString().padStart(10)}${flag}`);
      });
      console.log();
    }
  } catch {
    console.log('  ⚠ result_count 參數不存在（GA4 未收到此自訂維度）\n');
  }
}

async function checkSearchNoResults() {
  console.log('【3】查有無 search_no_results / no_search_results 類事件\n');

  const candidates = ['search_no_results', 'no_search_results', 'search_zero_results', 'search_empty'];
  for (const name of candidates) {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: name },
        },
      },
      limit: 1,
    });
    const count = parseInt(res.rows?.[0]?.metricValues?.[0]?.value ?? '0');
    const icon  = count > 0 ? '✅' : '❌';
    console.log(`  ${icon} ${name.padEnd(35)} ${count > 0 ? count.toLocaleString() + ' 次' : '無資料'}`);
  }
  console.log();
}

async function checkSearchTermWithSlot() {
  console.log('【4】search 事件 — 查有無 result_count 自訂參數\n');
  try {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [
        { name: 'customEvent:result_count' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'search' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    });

    if (!res.rows?.length) {
      console.log('  ⚠ search 事件的 result_count 參數為空（未埋）\n');
    } else {
      console.log(`  ${'result_count 值'.padEnd(20)} ${'次數'.padStart(10)}`);
      console.log('  ' + '─'.repeat(33));
      res.rows.forEach((r) => {
        const val   = r.dimensionValues?.[0]?.value ?? '(not set)';
        const count = parseInt(r.metricValues?.[0]?.value ?? '0');
        const flag  = val === '0' || val === '(not set)' ? '' : '';
        const zero  = val === '0' ? '  ← 零結果！' : '';
        console.log(`  ${val.padEnd(20)} ${count.toLocaleString().padStart(10)}${zero}`);
      });
      console.log();
    }
  } catch {
    console.log('  ⚠ search 事件無 result_count 自訂參數\n');
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ETMALL GA4 搜尋事件完整檢查                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await checkEventNames();
  await checkViewSearchResults();
  await checkSearchNoResults();
  await checkSearchTermWithSlot();

  console.log('【結論】');
  console.log('  如果以上 result_count 都是 (not set) 或無資料，');
  console.log('  代表目前 GA4 無法看到「搜尋無結果」的狀況，');
  console.log('  需請前端在搜尋結果頁補送 result_count 參數。\n');
}

main().catch(console.error);
