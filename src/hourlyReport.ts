/**
 * 每小時流量高低峰分析（近30天平均）
 * 執行：npx tsx src/hourlyReport.ts
 */
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

async function fetchHourlyAvg() {
  // 近30天，以 hour + dayOfWeek 分維度，算出平均
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'hour' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    orderBys: [{ dimension: { dimensionName: 'hour' }, desc: false }],
    limit: 24,
  });

  const rows = Array.from({ length: 24 }, (_, i) => ({
    hour: i, sessions: 0, users: 0, purchases: 0, revenue: 0,
  }));

  for (const r of res.rows ?? []) {
    const h = parseInt(r.dimensionValues?.[0]?.value ?? '0');
    if (h >= 0 && h < 24) {
      rows[h].sessions  = parseInt(r.metricValues?.[0]?.value ?? '0');
      rows[h].users     = parseInt(r.metricValues?.[1]?.value ?? '0');
      rows[h].purchases = parseInt(r.metricValues?.[2]?.value ?? '0');
      rows[h].revenue   = parseFloat(r.metricValues?.[3]?.value ?? '0');
    }
  }
  return rows;
}

// 平日 vs 假日分開
async function fetchHourlyByDayType() {
  const DIMS = [{ name: 'hour' }, { name: 'dayOfWeek' }]; // 0=Sun,1=Mon,...,6=Sat
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
    dimensions: DIMS,
    metrics: [{ name: 'sessions' }, { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' }],
    orderBys: [{ dimension: { dimensionName: 'hour' }, desc: false }],
    limit: 200,
  });

  const weekday = Array.from({ length: 24 }, (_, i) => ({ hour: i, sessions: 0, purchases: 0, revenue: 0, days: 0 }));
  const weekend = Array.from({ length: 24 }, (_, i) => ({ hour: i, sessions: 0, purchases: 0, revenue: 0, days: 0 }));

  for (const r of res.rows ?? []) {
    const h   = parseInt(r.dimensionValues?.[0]?.value ?? '0');
    const dow = parseInt(r.dimensionValues?.[1]?.value ?? '0'); // 0=Sun,6=Sat
    const s   = parseInt(r.metricValues?.[0]?.value ?? '0');
    const p   = parseInt(r.metricValues?.[1]?.value ?? '0');
    const rev = parseFloat(r.metricValues?.[2]?.value ?? '0');
    if (dow === 0 || dow === 6) { // 假日
      weekend[h].sessions  += s;
      weekend[h].purchases += p;
      weekend[h].revenue   += rev;
    } else {
      weekday[h].sessions  += s;
      weekday[h].purchases += p;
      weekday[h].revenue   += rev;
    }
  }
  return { weekday, weekend };
}

function bar(n: number, max: number, width = 30): string {
  const filled = Math.round(n / max * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function label(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ETMALL 每小時流量高低峰（近30天合計）                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const [overall, dayType] = await Promise.all([fetchHourlyAvg(), fetchHourlyByDayType()]);
  const { weekday, weekend } = dayType;

  const maxSess = Math.max(...overall.map((r) => r.sessions));
  const totalSess = overall.reduce((s, r) => s + r.sessions, 0);
  const totalPurch = overall.reduce((s, r) => s + r.purchases, 0);

  // ── 整體高低峰 ──
  console.log('【一】整體每小時 Sessions（近30天合計）\n');
  console.log(`  ${'時段'.padEnd(6)} ${'Sessions'.padStart(10)} ${'佔比'.padStart(6)} ${'訂單'.padStart(7)} ${'CVR%'.padStart(6)}   視覺化`);
  console.log('  ' + '─'.repeat(90));
  overall.forEach((r) => {
    const pct  = totalSess > 0 ? (r.sessions / totalSess * 100).toFixed(1) : '0';
    const cvr  = r.sessions > 0 ? (r.purchases / r.sessions * 100).toFixed(2) : '0.00';
    const peak = r.sessions === maxSess ? ' ◀ 尖峰' : '';
    console.log(`  ${label(r.hour)}   ${r.sessions.toLocaleString().padStart(10)} ${(pct + '%').padStart(6)} ${r.purchases.toLocaleString().padStart(7)} ${(cvr + '%').padStart(6)}   ${bar(r.sessions, maxSess)}${peak}`);
  });

  // 找尖峰/離峰
  const sorted = [...overall].sort((a, b) => b.sessions - a.sessions);
  const top3   = sorted.slice(0, 3);
  const bot3   = sorted.slice(-3);
  const cvrs   = [...overall].filter((r) => r.sessions > 10000).sort((a, b) => b.purchases / b.sessions - a.purchases / a.sessions);

  console.log('\n【二】重點摘要\n');
  console.log('  🔴 尖峰時段（sessions 最高）');
  top3.forEach((r, i) => {
    const cvr = r.sessions > 0 ? (r.purchases / r.sessions * 100).toFixed(2) : '0';
    console.log(`     ${i + 1}. ${label(r.hour)} — ${r.sessions.toLocaleString()} sessions，訂單 ${r.purchases.toLocaleString()}，CVR ${cvr}%`);
  });

  console.log('\n  🔵 離峰時段（sessions 最低）');
  bot3.reverse().forEach((r, i) => {
    console.log(`     ${i + 1}. ${label(r.hour)} — ${r.sessions.toLocaleString()} sessions`);
  });

  console.log('\n  💰 轉換率最高時段（session > 10K，CVR 最高）');
  cvrs.slice(0, 3).forEach((r, i) => {
    const cvr = (r.purchases / r.sessions * 100).toFixed(2);
    console.log(`     ${i + 1}. ${label(r.hour)} — CVR ${cvr}%，訂單 ${r.purchases.toLocaleString()}`);
  });

  // ── 平日 vs 假日對比（選6個代表時段）
  console.log('\n【三】平日 vs 假日 對比（sessions，近30天合計）\n');
  console.log(`  ${'時段'.padEnd(6)} ${'平日 Sessions'.padStart(16)} ${'假日 Sessions'.padStart(16)}  差異`);
  console.log('  ' + '─'.repeat(65));
  const keyHours = [0, 6, 9, 12, 15, 18, 20, 22, 23];
  keyHours.forEach((h) => {
    const wdS  = weekday[h].sessions;
    const weS  = weekend[h].sessions;
    const diff = weS - wdS;
    const sign = diff >= 0 ? '+' : '';
    const icon = diff > wdS * 0.1 ? '▲假日較高' : diff < -wdS * 0.1 ? '▼平日較高' : '≈ 相近';
    console.log(`  ${label(h)}   ${wdS.toLocaleString().padStart(16)} ${weS.toLocaleString().padStart(16)}  ${(sign + diff.toLocaleString()).padStart(10)}  ${icon}`);
  });

  // ── CSV 輸出 ──
  const { default: fs } = await import('fs');
  const { default: path } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const csv = [
    '時段,時間,sessions_30天,users_30天,訂單數_30天,CVR%,平日sessions,假日sessions',
    ...overall.map((r, i) => {
      const cvr = r.sessions > 0 ? (r.purchases / r.sessions * 100).toFixed(2) : '0';
      return [label(r.hour), `${r.hour}點`, r.sessions, r.users, r.purchases, cvr, weekday[i].sessions, weekend[i].sessions].join(',');
    }),
  ].join('\n');

  const csvPath = path.join(__dirname, '..', 'reports', 'hourly-traffic.csv');
  fs.writeFileSync(csvPath, '﻿' + csv, 'utf-8');
  console.log(`\n✅ 已輸出 CSV：reports/hourly-traffic.csv\n`);
}

main().catch(console.error);
