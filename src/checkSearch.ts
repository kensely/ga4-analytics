/**
 * 確認 GA4 站內搜尋資料可用性
 * 執行：npx tsx src/checkSearch.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

async function main() {
  // 方法1：searchTerm 維度（GA4 自動站內搜尋追蹤）
  console.log('\n【1】searchTerm 維度（前30天）');
  try {
    const [r1] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'searchTerm' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });
    console.log(`  筆數：${r1.rowCount ?? 0}`);
    (r1.rows ?? []).forEach((r, i) => {
      const term = r.dimensionValues?.[0]?.value ?? '';
      const sess = r.metricValues?.[0]?.value ?? '0';
      console.log(`  ${String(i+1).padStart(3)}. ${term.padEnd(30)} sessions: ${sess}`);
    });
  } catch (e: any) { console.log('  錯誤：', e.message); }

  // 方法2：eventName = view_search_results
  console.log('\n【2】event: view_search_results（前30天，含 searchTerm 參數）');
  try {
    const [r2] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'searchTerm' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'view_search_results' } },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    });
    console.log(`  筆數：${r2.rowCount ?? 0}`);
    (r2.rows ?? []).forEach((r, i) => {
      const term = r.dimensionValues?.[0]?.value ?? '';
      const cnt  = r.metricValues?.[0]?.value ?? '0';
      console.log(`  ${String(i+1).padStart(3)}. ${term.padEnd(30)} eventCount: ${cnt}`);
    });
  } catch (e: any) { console.log('  錯誤：', e.message); }

  // 方法3：customEvent: search（有些網站用自訂事件）
  console.log('\n【3】event: search（前30天）');
  try {
    const [r3] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'searchTerm' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'search' } },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    });
    console.log(`  筆數：${r3.rowCount ?? 0}`);
    (r3.rows ?? []).forEach((r, i) => {
      const term = r.dimensionValues?.[0]?.value ?? '';
      const cnt  = r.metricValues?.[0]?.value ?? '0';
      console.log(`  ${String(i+1).padStart(3)}. ${term.padEnd(30)} eventCount: ${cnt}`);
    });
  } catch (e: any) { console.log('  錯誤：', e.message); }

  // 方法4：看所有 eventName 裡有沒有 search 相關
  console.log('\n【4】所有 eventName（含 "search" 字樣）');
  try {
    const [r4] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    });
    const searchEvents = (r4.rows ?? []).filter((r) =>
      (r.dimensionValues?.[0]?.value ?? '').toLowerCase().includes('search')
    );
    if (searchEvents.length === 0) {
      console.log('  （無 search 相關 event）');
    } else {
      searchEvents.forEach((r) => {
        const name = r.dimensionValues?.[0]?.value ?? '';
        const cnt  = r.metricValues?.[0]?.value ?? '0';
        console.log(`  ${name.padEnd(40)} eventCount: ${cnt}`);
      });
    }
  } catch (e: any) { console.log('  錯誤：', e.message); }
}

main().catch(console.error);
