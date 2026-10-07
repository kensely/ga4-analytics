/**
 * 2024-08 MAU 異常調查
 * 執行：npx tsx src/diagnose2408.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const TARGET  = { startDate: '2024-08-01', endDate: '2024-08-31' };
const BEFORE  = { startDate: '2024-07-01', endDate: '2024-07-31' };
const AFTER   = { startDate: '2024-09-01', endDate: '2024-09-30' };

function fmt(n: number) { return n.toLocaleString().padStart(12); }
function pct(a: number, b: number) { return b > 0 ? (a / b * 100).toFixed(1) + '%' : '—'; }
function delta(cur: number, prev: number) {
  const d = cur - prev;
  const p = prev > 0 ? (d / prev * 100).toFixed(1) : '—';
  return `${d >= 0 ? '+' : ''}${d.toLocaleString()} (${d >= 0 ? '+' : ''}${p}%)`;
}

async function report(title: string, dimensions: string[], metrics: string[], filter?: any, limit = 20, dateRange = TARGET) {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [dateRange],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter: filter,
    orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
    limit,
  });

  console.log(`\n【${title}】`);
  const dimW = 45;
  const header = dimensions.map((d) => d.padEnd(dimW)).join('') +
    metrics.map((m) => m.padStart(14)).join('');
  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  for (const r of res.rows ?? []) {
    const dims = r.dimensionValues?.map((v) => (v.value ?? '').slice(0, dimW - 1).padEnd(dimW)).join('') ?? '';
    const mets = r.metricValues?.map((v) => v.value?.padStart(14) ?? '').join('') ?? '';
    console.log('  ' + dims + mets);
  }
}

async function compareChannel() {
  console.log('\n【渠道對比：7月 vs 8月 vs 9月】\n');

  const fetch = async (dr: any) => {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [dr],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    });
    const map = new Map<string, { users: number; new: number; sessions: number }>();
    for (const r of res.rows ?? []) {
      map.set(r.dimensionValues?.[0]?.value ?? '', {
        users:    parseInt(r.metricValues?.[0]?.value ?? '0'),
        new:      parseInt(r.metricValues?.[1]?.value ?? '0'),
        sessions: parseInt(r.metricValues?.[2]?.value ?? '0'),
      });
    }
    return map;
  };

  const [jul, aug, sep] = await Promise.all([fetch(BEFORE), fetch(TARGET), fetch(AFTER)]);
  const channels = new Set([...jul.keys(), ...aug.keys(), ...sep.keys()]);

  console.log(`  ${'渠道'.padEnd(30)} ${'7月 Users'.padStart(12)} ${'8月 Users'.padStart(12)} ${'9月 Users'.padStart(12)} ${'8月 Sessions'.padStart(14)} ${'8月 新用戶'.padStart(12)}`);
  console.log('  ' + '─'.repeat(95));

  const rows = [...channels].map((ch) => ({
    ch,
    jul: jul.get(ch)?.users ?? 0,
    aug: aug.get(ch)?.users ?? 0,
    sep: sep.get(ch)?.users ?? 0,
    augSess: aug.get(ch)?.sessions ?? 0,
    augNew:  aug.get(ch)?.new ?? 0,
  })).sort((a, b) => b.aug - a.aug);

  for (const r of rows) {
    const d = r.aug - r.jul;
    const sign = d >= 0 ? '+' : '';
    console.log(
      `  ${r.ch.padEnd(30)} ${fmt(r.jul)} ${fmt(r.aug)} ${fmt(r.sep)}` +
      `   ${sign}${delta(r.aug, r.jul).padEnd(22)} new=${fmt(r.augNew)}`
    );
  }
}

async function compareSource() {
  console.log('\n【來源媒介 Top20：8月 vs 7月 新用戶差異】\n');

  const fetch = async (dr: any) => {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [dr],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'newUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
      limit: 50,
    });
    const map = new Map<string, { new: number; sessions: number }>();
    for (const r of res.rows ?? []) {
      map.set(r.dimensionValues?.[0]?.value ?? '', {
        new:      parseInt(r.metricValues?.[0]?.value ?? '0'),
        sessions: parseInt(r.metricValues?.[1]?.value ?? '0'),
      });
    }
    return map;
  };

  const [jul, aug] = await Promise.all([fetch(BEFORE), fetch(TARGET)]);
  const all = new Set([...jul.keys(), ...aug.keys()]);

  const rows = [...all].map((sm) => ({
    sm,
    julNew: jul.get(sm)?.new ?? 0,
    augNew: aug.get(sm)?.new ?? 0,
    augSess: aug.get(sm)?.sessions ?? 0,
    diff: (aug.get(sm)?.new ?? 0) - (jul.get(sm)?.new ?? 0),
  })).sort((a, b) => b.diff - a.diff).slice(0, 20);

  console.log(`  ${'來源媒介'.padEnd(45)} ${'7月新用戶'.padStart(12)} ${'8月新用戶'.padStart(12)} ${'差異'.padStart(14)} ${'8月Sessions'.padStart(13)}`);
  console.log('  ' + '─'.repeat(100));

  for (const r of rows) {
    const sign = r.diff >= 0 ? '+' : '';
    console.log(`  ${r.sm.slice(0, 44).padEnd(45)} ${fmt(r.julNew)} ${fmt(r.augNew)} ${(sign + r.diff.toLocaleString()).padStart(14)} ${fmt(r.augSess)}`);
  }
}

async function dailyTrend() {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '2024-07-15', endDate: '2024-09-15' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 100,
  });

  console.log('\n【逐日趨勢（7/15 ～ 9/15）找轉折點】\n');
  console.log(`  ${'日期'.padEnd(12)} ${'Users'.padStart(10)} ${'新用戶'.padStart(10)} ${'Sessions'.padStart(12)} 視覺化`);
  console.log('  ' + '─'.repeat(70));

  const maxU = Math.max(...(res.rows ?? []).map((r) => parseInt(r.metricValues?.[0]?.value ?? '0')));

  for (const r of res.rows ?? []) {
    const date = r.dimensionValues?.[0]?.value ?? '';
    const u    = parseInt(r.metricValues?.[0]?.value ?? '0');
    const nu   = parseInt(r.metricValues?.[1]?.value ?? '0');
    const s    = parseInt(r.metricValues?.[2]?.value ?? '0');
    const bar  = '█'.repeat(Math.round(u / maxU * 25));
    const flag = date >= '20240801' && date <= '20240831' ? ' ◀' : '';
    console.log(`  ${date}   ${u.toLocaleString().padStart(8)} ${nu.toLocaleString().padStart(10)} ${s.toLocaleString().padStart(12)}   ${bar}${flag}`);
  }
}

async function geoCheck() {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [TARGET],
    dimensions: [{ name: 'country' }],
    metrics: [{ name: 'newUsers' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
    limit: 15,
  });

  console.log('\n【國家分布（8月）Top 15】\n');
  console.log(`  ${'國家'.padEnd(30)} ${'新用戶'.padStart(12)} ${'Sessions'.padStart(12)}`);
  console.log('  ' + '─'.repeat(58));

  for (const r of res.rows ?? []) {
    const country = r.dimensionValues?.[0]?.value ?? '';
    const nu   = parseInt(r.metricValues?.[0]?.value ?? '0');
    const sess = parseInt(r.metricValues?.[1]?.value ?? '0');
    console.log(`  ${country.padEnd(30)} ${fmt(nu)} ${fmt(sess)}`);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   2024-08 MAU 異常調查                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await compareChannel();
  await compareSource();
  await dailyTrend();
  await geoCheck();

  console.log('\n完成\n');
}

main().catch(console.error);
