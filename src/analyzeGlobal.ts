/**
 * 全球購商品分析：月度 CVR 趨勢 + 流量來源
 * 執行方式：npx tsx src/analyzeGlobal.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const GLOBAL_CATEGORIES = ['生活館', '免運館', '好康館'];
const SITE_DOMAIN    = 'etmall.com.tw';
const SEARCH_DOMAINS = ['google', 'yahoo', 'bing', 'baidu', 'duckduckgo', 'naver', 'syndicatedsearch.goog'];

// ── 月度 CVR：2025-01-01 ～ 今 ──
async function fetchMonthlyCvr() {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '2025-01-01', endDate: 'yesterday' }],
    dimensions: [{ name: 'yearMonth' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'itemCategory',
        inListFilter: { values: GLOBAL_CATEGORIES, caseSensitive: true },
      },
    },
    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    limit: 50,
  });
  return (response.rows ?? []).map((r) => ({
    yearMonth:  r.dimensionValues?.[0]?.value ?? '',
    sessions:   parseInt(r.metricValues?.[0]?.value ?? '0'),
    users:      parseInt(r.metricValues?.[1]?.value ?? '0'),
    purchases:  parseInt(r.metricValues?.[2]?.value ?? '0'),
    revenue:    parseFloat(r.metricValues?.[3]?.value ?? '0'),
  }));
}

// ── 渠道分布：2026-01-01 ～ 今 ──
async function fetchGlobalByChannel() {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '2026-01-01', endDate: 'yesterday' }],
    dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'itemCategory',
        inListFilter: { values: GLOBAL_CATEGORIES, caseSensitive: true },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  });
  return (response.rows ?? []).map((r) => ({
    channel:   r.dimensionValues?.[0]?.value ?? '',
    sessions:  parseInt(r.metricValues?.[0]?.value ?? '0'),
    users:     parseInt(r.metricValues?.[1]?.value ?? '0'),
    purchases: parseInt(r.metricValues?.[2]?.value ?? '0'),
    revenue:   parseFloat(r.metricValues?.[3]?.value ?? '0'),
  }));
}

// ── pageReferrer 落地前一頁：2026-01-01 ～ 今 ──
async function fetchGlobalReferrers() {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '2026-01-01', endDate: 'yesterday' }],
    dimensions: [{ name: 'pageReferrer' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: 'eventName',    stringFilter: { matchType: 'EXACT', value: 'view_item' } } },
          { filter: { fieldName: 'itemCategory', inListFilter: { values: GLOBAL_CATEGORIES, caseSensitive: true } } },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 500,
  });
  return (response.rows ?? []).map((r) => ({
    ref: r.dimensionValues?.[0]?.value ?? '',
    cnt: parseInt(r.metricValues?.[0]?.value ?? '0'),
  }));
}

function classifyReferrer(ref: string): string {
  if (!ref || ref.trim() === '' || ref === '(not set)') return '直接進入 / App';
  const lower = ref.toLowerCase();
  if (lower.includes(SITE_DOMAIN))                        return '站內路徑';
  if (SEARCH_DOMAINS.some((d) => lower.includes(d)))      return '站外搜尋';
  if (lower.includes('android-app://com.google'))         return '站外搜尋';
  if (lower.includes('facebook') || lower.includes('threads') || lower.includes('instagram')) return '社群媒體';
  if (lower.includes('line.android') || lower.includes('jp.naver.line')) return '社群媒體';
  if (lower.includes('youtube'))                          return '社群媒體';
  if (lower.includes('criteo') || lower.includes('doubleclick') || lower.includes('scupio') || lower.includes('creativecdn') || lower.includes('rtbhouse')) return '廣告平台';
  if (lower.includes('shopee') || lower.includes('etmall') || lower.includes('feebee') || lower.includes('biggo') || lower.includes('shopback')) return '購物/比價平台';
  return '其他外站';
}

function momBadge(cur: number, prev: number): string {
  if (!prev) return '     —    ';
  const pct = ((cur - prev) / prev * 100).toFixed(1);
  const sign = parseFloat(pct) >= 0 ? '+' : '';
  return `${sign}${pct}%`;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   全球購商品分析（生活館 / 免運館 / 好康館）        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ══════════════════════════════════════
  // 1. 月度 CVR 趨勢（2025-01 ～ 今）
  // ══════════════════════════════════════
  console.log('【一】月度 CVR 趨勢（2025-01 ～ 最新，全球購三館合計）');
  console.log('─'.repeat(75));
  console.log(
    '  月份     Sessions    用戶數    訂單數   CVR(%)   MOM CVR   營收(萬)'
  );
  console.log('─'.repeat(75));

  const cvrRows = await fetchMonthlyCvr();
  let prevCvr = 0;
  cvrRows.forEach((r) => {
    const cvr   = r.sessions > 0 ? r.purchases / r.sessions * 100 : 0;
    const mom   = momBadge(cvr, prevCvr);
    const label = r.yearMonth.slice(0, 4) + '-' + r.yearMonth.slice(4, 6);
    const rev   = (r.revenue / 10000).toFixed(1);
    console.log(
      `  ${label}   ${String(r.sessions.toLocaleString()).padStart(9)}` +
      `  ${String(r.users.toLocaleString()).padStart(8)}` +
      `  ${String(r.purchases.toLocaleString()).padStart(7)}` +
      `  ${cvr.toFixed(2).padStart(7)}%` +
      `  ${mom.padStart(9)}` +
      `  ${rev.padStart(8)}`
    );
    prevCvr = cvr;
  });
  console.log('─'.repeat(75));

  // ══════════════════════════════════════
  // 2. 渠道分布（2026-01 ～ 今）
  // ══════════════════════════════════════
  console.log('\n【二】Session 渠道分布（2026-01-01 ～ 今）');
  console.log('─'.repeat(78));
  console.log('  渠道                          Sessions    佔比     訂單數   CVR(%)   營收(萬)');
  console.log('─'.repeat(78));

  const chRows = await fetchGlobalByChannel();
  const totalSessions = chRows.reduce((s, r) => s + r.sessions, 0);
  const totalPurchases = chRows.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue   = chRows.reduce((s, r) => s + r.revenue, 0);

  chRows.forEach((r) => {
    const pct = totalSessions > 0 ? (r.sessions / totalSessions * 100).toFixed(1) : '0';
    const cvr = r.sessions > 0 ? (r.purchases / r.sessions * 100).toFixed(2) : '0.00';
    const rev = (r.revenue / 10000).toFixed(1);
    console.log(
      `  ${r.channel.padEnd(30)}` +
      `  ${String(r.sessions.toLocaleString()).padStart(9)}` +
      `  ${(pct + '%').padStart(6)}` +
      `  ${String(r.purchases.toLocaleString()).padStart(7)}` +
      `  ${(cvr + '%').padStart(7)}` +
      `  ${rev.padStart(8)}`
    );
  });
  console.log('─'.repeat(78));
  const totalCvr = totalSessions > 0 ? (totalPurchases / totalSessions * 100).toFixed(2) : '0';
  console.log(
    `  ${'合計'.padEnd(30)}  ${String(totalSessions.toLocaleString()).padStart(9)}  ${'100%'.padStart(6)}` +
    `  ${String(totalPurchases.toLocaleString()).padStart(7)}  ${(totalCvr + '%').padStart(7)}` +
    `  ${(totalRevenue / 10000).toFixed(1).padStart(8)}`
  );

  // ══════════════════════════════════════
  // 3. 流量來源分類（pageReferrer）
  // ══════════════════════════════════════
  console.log('\n【三】商品瀏覽流量來源分類（view_item 事件，2026-01-01 ～ 今）');
  console.log('─'.repeat(55));

  const refRows = await fetchGlobalReferrers();
  const totalEvents = refRows.reduce((s, r) => s + r.cnt, 0);
  const buckets = new Map<string, number>();
  refRows.forEach((r) => {
    const cat = classifyReferrer(r.ref);
    buckets.set(cat, (buckets.get(cat) ?? 0) + r.cnt);
  });
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  sorted.forEach(([cat, cnt]) => {
    const pct = totalEvents > 0 ? (cnt / totalEvents * 100).toFixed(1) : '0';
    const bar = '█'.repeat(Math.round(parseFloat(pct) / 2));
    console.log(`  ${cat.padEnd(16)} ${String(cnt.toLocaleString()).padStart(10)} (${(pct + '%').padStart(5)})  ${bar}`);
  });
  console.log('─'.repeat(55));
  console.log(`  ${'合計'.padEnd(16)} ${totalEvents.toLocaleString().padStart(10)}`);

  console.log('\n  📌 結論：');
  const search   = buckets.get('站外搜尋') ?? 0;
  const internal = buckets.get('站內路徑') ?? 0;
  const direct   = buckets.get('直接進入 / App') ?? 0;
  const social   = buckets.get('社群媒體') ?? 0;
  console.log(`  站外搜尋  ${(search   / totalEvents * 100).toFixed(1)}%  ／  站內路徑 ${(internal / totalEvents * 100).toFixed(1)}%`);
  console.log(`  直接/App  ${(direct   / totalEvents * 100).toFixed(1)}%  ／  社群媒體 ${(social   / totalEvents * 100).toFixed(1)}%`);
}

main().catch(console.error);
