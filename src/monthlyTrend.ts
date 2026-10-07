/**
 * 月度趨勢分析（2025-01 ～ 今）
 * 執行：npx tsx src/monthlyTrend.ts
 * 輸出：reports/monthly-trend.csv、reports/monthly-channel.csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const START = '2025-01-01';
const END   = 'yesterday';

function esc(s: string | number) {
  const str = String(s);
  return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
}

// ── 整體月度指標 ──────────────────────────────────────────────
async function fetchOverall() {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: START, endDate: END }],
    dimensions: [{ name: 'yearMonth' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
      { name: 'addToCarts' },
      { name: 'checkouts' },
      { name: 'newUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'yearMonth' }, desc: false }],
    limit: 100,
  });

  return (res.rows ?? []).map((r) => {
    const ym       = r.dimensionValues?.[0]?.value ?? '';
    const users    = parseInt(r.metricValues?.[0]?.value ?? '0');
    const sessions = parseInt(r.metricValues?.[1]?.value ?? '0');
    const orders   = parseInt(r.metricValues?.[2]?.value ?? '0');
    const revenue  = parseFloat(r.metricValues?.[3]?.value ?? '0');
    const carts    = parseInt(r.metricValues?.[4]?.value ?? '0');
    const checkout = parseInt(r.metricValues?.[5]?.value ?? '0');
    const newU     = parseInt(r.metricValues?.[6]?.value ?? '0');

    const cvr      = sessions > 0 ? (orders / sessions * 100) : 0;
    const aov      = orders   > 0 ? (revenue / orders)        : 0;
    const cartRate = sessions > 0 ? (carts / sessions * 100)  : 0;
    const ckRate   = carts    > 0 ? (checkout / carts * 100)  : 0;
    const buyRate  = checkout > 0 ? (orders / checkout * 100) : 0;
    const sessUser = users    > 0 ? (sessions / users)        : 0;
    const retRate  = users    > 0 ? ((users - newU) / users * 100) : 0;

    return {
      年月: `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
      MAU用戶數: users,
      新用戶數: newU,
      回訪用戶數: users - newU,
      回訪率pct: retRate.toFixed(1),
      Sessions: sessions,
      Sessions每用戶: sessUser.toFixed(2),
      訂單數: orders,
      營收: Math.round(revenue),
      轉換率pct: cvr.toFixed(2),
      AOV客單價: Math.round(aov),
      加購次數: carts,
      加購率pct: cartRate.toFixed(2),
      結帳次數: checkout,
      結帳率pct: ckRate.toFixed(2),
      結帳完成率pct: buyRate.toFixed(2),
    };
  });
}

// ── 渠道月度拆解 ──────────────────────────────────────────────
async function fetchChannel() {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: START, endDate: END }],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'sessionDefaultChannelGroup' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    orderBys: [
      { dimension: { dimensionName: 'yearMonth' }, desc: false },
      { metric: { metricName: 'sessions' }, desc: true },
    ],
    limit: 2000,
  });

  return (res.rows ?? []).map((r) => {
    const ym       = r.dimensionValues?.[0]?.value ?? '';
    const channel  = r.dimensionValues?.[1]?.value ?? '';
    const sessions = parseInt(r.metricValues?.[0]?.value ?? '0');
    const users    = parseInt(r.metricValues?.[1]?.value ?? '0');
    const orders   = parseInt(r.metricValues?.[2]?.value ?? '0');
    const revenue  = parseFloat(r.metricValues?.[3]?.value ?? '0');
    const cvr      = sessions > 0 ? (orders / sessions * 100) : 0;
    const aov      = orders   > 0 ? (revenue / orders)        : 0;

    return {
      年月: `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
      渠道: channel,
      Sessions: sessions,
      用戶數: users,
      訂單數: orders,
      營收: Math.round(revenue),
      轉換率pct: cvr.toFixed(2),
      AOV客單價: Math.round(aov),
    };
  });
}

function writeCsv(filePath: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ];
  fs.writeFileSync(filePath, '﻿' + lines.join('\n'), 'utf-8');
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ETMALL 月度趨勢分析（2025-01 ～ 今）                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('正在拉取資料...\n');

  const [overall, channel] = await Promise.all([fetchOverall(), fetchChannel()]);

  // ── 終端機快覽 ──
  console.log('【整體月度指標】\n');
  console.log(
    `  ${'年月'.padEnd(8)} ${'MAU'.padStart(8)} ${'Sessions'.padStart(10)} ${'訂單'.padStart(7)} ${'營收(萬)'.padStart(10)} ${'CVR%'.padStart(7)} ${'AOV'.padStart(8)} ${'加購率%'.padStart(8)} ${'回訪率%'.padStart(8)}`
  );
  console.log('  ' + '─'.repeat(88));
  overall.forEach((r) => {
    const revWan = (r.營收 / 10000).toFixed(1);
    console.log(
      `  ${r.年月.padEnd(8)} ${String(r.MAU用戶數.toLocaleString()).padStart(8)} ${String(r.Sessions.toLocaleString()).padStart(10)} ${String(r.訂單數.toLocaleString()).padStart(7)} ${(revWan + ' 萬').padStart(10)} ${(r.轉換率pct + '%').padStart(7)} ${String(r.AOV客單價.toLocaleString()).padStart(8)} ${(r.加購率pct + '%').padStart(8)} ${(r.回訪率pct + '%').padStart(8)}`
    );
  });

  // 輸出 CSV
  const reportsDir = path.join(__dirname, '..', 'reports');
  const trendPath   = path.join(reportsDir, 'monthly-trend.csv');
  const channelPath = path.join(reportsDir, 'monthly-channel.csv');

  writeCsv(trendPath,   overall);
  writeCsv(channelPath, channel);

  console.log(`\n✅ 已輸出：`);
  console.log(`   reports/monthly-trend.csv   （整體月度，${overall.length} 個月）`);
  console.log(`   reports/monthly-channel.csv （渠道拆解，${channel.length} 筆）\n`);

  // 簡易異常偵測
  if (overall.length >= 2) {
    console.log('【快速診斷】');
    const last  = overall[overall.length - 1];
    const prev  = overall[overall.length - 2];
    const fields: [string, string | number, string | number][] = [
      ['MAU',   last.MAU用戶數, prev.MAU用戶數],
      ['Sessions', last.Sessions, prev.Sessions],
      ['訂單數', last.訂單數, prev.訂單數],
      ['轉換率%', parseFloat(last.轉換率pct), parseFloat(prev.轉換率pct)],
      ['AOV',   last.AOV客單價, prev.AOV客單價],
    ];
    fields.forEach(([name, cur, prv]) => {
      const diff = ((Number(cur) - Number(prv)) / Number(prv) * 100);
      const icon = diff >= 0 ? '▲' : '▼';
      const color = diff >= 0 ? '' : ' ⚠';
      console.log(`  ${icon} ${name}：${prv.toLocaleString()} → ${Number(cur).toLocaleString()}（${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%）${color}`);
    });
    console.log();
  }
}

main().catch(console.error);
