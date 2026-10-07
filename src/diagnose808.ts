/**
 * 診斷 2026-08-08 流量異常
 * 執行：npx tsx src/diagnose808.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const DATE = '2026-08-08';
const COMPARE = '2026-08-07'; // 前一天作為基準

async function fetch(label: string, dims: string[], orderMetric = 'sessions', extra?: object) {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: DATE, endDate: DATE }],
    dimensions: dims.map((name) => ({ name })),
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: 30,
    ...extra,
  });
  return { label, rows: res.rows ?? [] };
}

async function fetchCompare(dims: string[], dimFilter?: object) {
  const [today] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: DATE, endDate: DATE }],
    dimensions: dims.map((n) => ({ name: n })),
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
    ...(dimFilter ? { dimensionFilter: dimFilter } : {}),
  });
  const [prev] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: COMPARE, endDate: COMPARE }],
    dimensions: dims.map((n) => ({ name: n })),
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
    ...(dimFilter ? { dimensionFilter: dimFilter } : {}),
  });
  return { today: today.rows ?? [], prev: prev.rows ?? [] };
}

function fmt(n: number) { return n.toLocaleString().padStart(10); }
function pct(a: number, b: number) { if (!b) return '    NEW'; const p = ((a - b) / b * 100).toFixed(0); return (parseFloat(p) >= 0 ? '+' : '') + p + '%'; }

async function main() {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   流量異常診斷：${DATE} vs ${COMPARE}                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  // ── 1. 整體對比 ──
  const { today: t0, prev: p0 } = await fetchCompare(['date']);
  const todaySess = parseInt(t0[0]?.metricValues?.[0]?.value ?? '0');
  const prevSess  = parseInt(p0[0]?.metricValues?.[0]?.value ?? '0');
  console.log(`【1】總 Sessions 比較`);
  console.log(`  ${COMPARE}：${fmt(prevSess)}`);
  console.log(`  ${DATE}  ：${fmt(todaySess)}  (${pct(todaySess, prevSess)})\n`);

  // ── 2. 渠道分布 ──
  const ch = await fetch('渠道', ['sessionDefaultChannelGrouping']);
  console.log(`【2】渠道分布（${DATE}）`);
  console.log(`  ${'渠道'.padEnd(30)} ${'Sessions'.padStart(10)} ${'訂單'.padStart(7)} ${'CVR%'.padStart(7)}`);
  console.log('  ' + '─'.repeat(58));
  ch.rows.forEach((r) => {
    const ch  = r.dimensionValues?.[0]?.value ?? '';
    const s   = parseInt(r.metricValues?.[0]?.value ?? '0');
    const p   = parseInt(r.metricValues?.[2]?.value ?? '0');
    const cvr = s > 0 ? (p / s * 100).toFixed(2) : '0.00';
    console.log(`  ${ch.padEnd(30)} ${fmt(s)} ${String(p).padStart(7)} ${(cvr + '%').padStart(7)}`);
  });

  // ── 3. Source / Medium 分布（Top 25） ──
  const sm = await fetch('Source/Medium', ['sessionSource', 'sessionMedium']);
  console.log(`\n【3】流量來源 / 媒介 Top 25（${DATE}）`);
  console.log(`  ${'Source'.padEnd(30)} ${'Medium'.padEnd(20)} ${'Sessions'.padStart(10)} ${'訂單'.padStart(7)}`);
  console.log('  ' + '─'.repeat(72));
  sm.rows.slice(0, 25).forEach((r) => {
    const src = r.dimensionValues?.[0]?.value ?? '';
    const med = r.dimensionValues?.[1]?.value ?? '';
    const s   = parseInt(r.metricValues?.[0]?.value ?? '0');
    const p   = parseInt(r.metricValues?.[2]?.value ?? '0');
    console.log(`  ${src.padEnd(30)} ${med.padEnd(20)} ${fmt(s)} ${String(p).padStart(7)}`);
  });

  // ── 4. 特別篩查 source = 'web' / medium = 'web' ──
  console.log(`\n【4】source 或 medium 含 "web" 的細項`);
  const [webRes] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: DATE, endDate: DATE }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }, { name: 'sessionDefaultChannelGrouping' }],
    metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' }],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'web', caseSensitive: false } } },
          { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'CONTAINS', value: 'web', caseSensitive: false } } },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  });
  if ((webRes.rows ?? []).length === 0) {
    console.log('  （無 source/medium 含 "web" 的流量）');
  } else {
    console.log(`  ${'Source'.padEnd(25)} ${'Medium'.padEnd(20)} ${'Campaign'.padEnd(30)} ${'Channel'.padEnd(20)} ${'Sess'.padStart(8)}`);
    console.log('  ' + '─'.repeat(108));
    (webRes.rows ?? []).forEach((r) => {
      const src = r.dimensionValues?.[0]?.value ?? '';
      const med = r.dimensionValues?.[1]?.value ?? '';
      const cam = (r.dimensionValues?.[2]?.value ?? '').slice(0, 28);
      const chn = r.dimensionValues?.[3]?.value ?? '';
      const s   = parseInt(r.metricValues?.[0]?.value ?? '0');
      const p   = parseInt(r.metricValues?.[1]?.value ?? '0');
      console.log(`  ${src.padEnd(25)} ${med.padEnd(20)} ${cam.padEnd(30)} ${chn.padEnd(20)} ${fmt(s)}  orders:${p}`);
    });
  }

  // ── 5. 比較昨天差最大的 Source ──
  console.log(`\n【5】Source 對比：${DATE} vs ${COMPARE}（增加最多 Top 15）`);
  const { today: tS, prev: pS } = await fetchCompare(['sessionSource']);
  const todayMap = new Map<string, number>();
  const prevMap  = new Map<string, number>();
  tS.forEach((r) => todayMap.set(r.dimensionValues?.[0]?.value ?? '', parseInt(r.metricValues?.[0]?.value ?? '0')));
  pS.forEach((r) => prevMap.set( r.dimensionValues?.[0]?.value ?? '', parseInt(r.metricValues?.[0]?.value ?? '0')));
  const allSrc = [...new Set([...todayMap.keys(), ...prevMap.keys()])];
  const diffs  = allSrc
    .map((s) => ({ src: s, today: todayMap.get(s) ?? 0, prev: prevMap.get(s) ?? 0 }))
    .map((x) => ({ ...x, diff: x.today - x.prev }))
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 15);
  console.log(`  ${'Source'.padEnd(30)} ${COMPARE.padStart(12)} ${DATE.padStart(12)} ${'差異'.padStart(10)} ${'變化%'.padStart(8)}`);
  console.log('  ' + '─'.repeat(78));
  diffs.forEach((x) => {
    console.log(`  ${x.src.padEnd(30)} ${fmt(x.prev)} ${fmt(x.today)} ${String(x.diff > 0 ? '+' + x.diff : x.diff).padStart(10)} ${pct(x.today, x.prev).padStart(8)}`);
  });

  // ── 6. 落地頁 Top 20（看流量往哪去） ──
  const lp = await fetch('落地頁', ['landingPage']);
  console.log(`\n【6】落地頁 Top 20（${DATE}）`);
  console.log(`  ${'頁面'.padEnd(55)} ${'Sessions'.padStart(10)}`);
  console.log('  ' + '─'.repeat(68));
  lp.rows.slice(0, 20).forEach((r) => {
    const pg = (r.dimensionValues?.[0]?.value ?? '').slice(0, 53);
    const s  = parseInt(r.metricValues?.[0]?.value ?? '0');
    console.log(`  ${pg.padEnd(55)} ${fmt(s)}`);
  });

  // ── 7. deviceCategory ──
  const dc = await fetch('裝置', ['deviceCategory']);
  console.log(`\n【7】裝置分布（${DATE}）`);
  dc.rows.forEach((r) => {
    const d = r.dimensionValues?.[0]?.value ?? '';
    const s = parseInt(r.metricValues?.[0]?.value ?? '0');
    const u = parseInt(r.metricValues?.[1]?.value ?? '0');
    console.log(`  ${d.padEnd(12)} sessions:${fmt(s)}  users:${fmt(u)}`);
  });

  console.log('\n✅ 診斷完成\n');
}

main().catch(console.error);
