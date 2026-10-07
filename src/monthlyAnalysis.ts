/**
 * 月度分析四表（2024-01 ～ 2026-08）
 * 執行：npx tsx src/monthlyAnalysis.ts
 *
 * 輸出：
 *   reports/A1_monthly_overall.csv      — 整體概況
 *   reports/A2_monthly_source.csv       — 流量來源
 *   reports/A3_monthly_campaign.csv     — 廣告活動成效
 *   reports/A4_monthly_new_user_src.csv — 新客來源
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const START      = '2024-01-01';
const END        = '2026-08-31';   // 含完整月份
const HOSTNAME   = null;  // null = 全站含 APP

// ── 工具 ──────────────────────────────────────────────────────

function esc(v: string | number): string {
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(name: string, rows: Record<string, string | number>[]) {
  if (!rows.length) { console.log(`[${name}] 無資料`); return; }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))];
  const outPath = path.join(REPORTS_DIR, `${name}.csv`);
  fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf-8');
  console.log(`✅ ${name}.csv — ${rows.length.toLocaleString()} 筆`);
}

function hostFilter() {
  if (!HOSTNAME) return undefined;
  return {
    filter: {
      fieldName: 'hostName',
      stringFilter: { matchType: 'EXACT' as const, value: HOSTNAME },
    },
  };
}

async function runReport(opts: {
  dimensions: string[];
  metrics: string[];
  filter?: object;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const allRows: any[] = [];
  let offset = 0;
  const limit = Math.min(opts.limit ?? 100_000, 100_000);

  while (true) {
    const [res] = await analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: opts.startDate ?? START, endDate: opts.endDate ?? END }],
      dimensions: opts.dimensions.map((name) => ({ name })),
      metrics: opts.metrics.map((name) => ({ name })),
      dimensionFilter: opts.filter as any,
      orderBys: [{ dimension: { dimensionName: opts.dimensions[0] }, desc: false }],
      limit,
      offset,
    });

    for (const r of res.rows ?? []) {
      const rec: Record<string, string | number> = {};
      opts.dimensions.forEach((d, i) => { rec[d] = r.dimensionValues?.[i]?.value ?? ''; });
      opts.metrics.forEach((m, i) => {
        const v = r.metricValues?.[i]?.value ?? '0';
        rec[m] = m.includes('Revenue') || m.includes('revenue') ? parseFloat(v) : parseInt(v);
      });
      allRows.push(rec);
    }

    const got = res.rows?.length ?? 0;
    offset += got;
    if (got === 0 || offset >= (res.rowCount ?? 0)) break;
  }

  return allRows;
}

// ── A1：每月整體概況 ───────────────────────────────────────────
async function a1Overall() {
  console.log('\n⏳ A1 整體概況...');
  const raw = await runReport({
    dimensions: ['yearMonth'],
    metrics: ['activeUsers', 'totalUsers', 'newUsers', 'sessions',
              'engagedSessions', 'ecommercePurchases', 'purchaseRevenue'],
    filter: hostFilter(),
  });

  const rows = raw.map((r) => {
    const ym  = String(r.yearMonth);
    const au  = Number(r.activeUsers);
    const ses = Number(r.sessions);
    const pch = Number(r.ecommercePurchases);
    const rev = Number(r.purchaseRevenue);
    return {
      年月:             `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
      活躍使用者_MAU:   au,
      使用者總數:       r.totalUsers,
      新使用者:         r.newUsers,
      工作階段:         ses,
      互動工作階段:     r.engagedSessions,
      電商購買次數:     pch,
      購買收益:         Math.round(rev),
      轉換率pct:        ses > 0 ? (pch / ses * 100).toFixed(2) : '0.00',
      AOV:              pch > 0 ? Math.round(rev / pch) : 0,
      新客占比pct:      au  > 0 ? (Number(r.newUsers) / au * 100).toFixed(1) : '0.0',
    };
  });

  writeCsv('A1_monthly_overall', rows);
}

// ── A2：每月流量來源 ───────────────────────────────────────────
async function a2Source() {
  console.log('⏳ A2 流量來源...');
  const raw = await runReport({
    dimensions: ['yearMonth', 'sessionSourceMedium', 'sessionDefaultChannelGroup'],
    metrics: ['activeUsers', 'sessions', 'engagedSessions',
              'ecommercePurchases', 'purchaseRevenue'],
    filter: hostFilter(),
    limit: 100_000,
  });

  const rows = raw.map((r) => {
    const ym  = String(r.yearMonth);
    const ses = Number(r.sessions);
    const pch = Number(r.ecommercePurchases);
    const rev = Number(r.purchaseRevenue);
    return {
      年月:             `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
      來源媒介:         r.sessionSourceMedium,
      管道群組:         r.sessionDefaultChannelGroup,
      活躍使用者:       r.activeUsers,
      工作階段:         ses,
      互動工作階段:     r.engagedSessions,
      電商購買次數:     pch,
      購買收益:         Math.round(rev),
      轉換率pct:        ses > 0 ? (pch / ses * 100).toFixed(2) : '0.00',
      AOV:              pch > 0 ? Math.round(rev / pch) : 0,
    };
  });

  writeCsv('A2_monthly_source', rows);
}

// ── A3：每月廣告活動成效（按年拆分，避免超過 GA4 API 20MB 限制）──
async function a3Campaign() {
  console.log('⏳ A3 廣告活動成效（按年分批查詢）...');

  const YEAR_RANGES = [
    ['2024-01-01', '2024-12-31'],
    ['2025-01-01', '2025-12-31'],
    ['2026-01-01', '2026-08-31'],
  ];

  const allChunks: any[] = [];
  for (const [s, e] of YEAR_RANGES) {
    console.log(`   → ${s.slice(0, 4)} 年...`);
    const chunk = await runReport({
      dimensions: ['yearMonth', 'sessionSourceMedium', 'sessionCampaignName'],
      metrics: ['sessions', 'engagedSessions', 'activeUsers',
                'ecommercePurchases', 'purchaseRevenue'],
      filter: hostFilter(),
      limit: 100_000,
      startDate: s,
      endDate: e,
    });
    allChunks.push(...chunk);
  }
  const raw = allChunks;

  // 排除非廣告流量（直接、自然、(not set) 活動名稱）
  const SKIP_CAMPAIGNS = new Set(['(not set)', '(direct)', 'organic', '']);

  const rows = raw
    .filter((r) => !SKIP_CAMPAIGNS.has(String(r.sessionCampaignName)))
    .map((r) => {
      const ym  = String(r.yearMonth);
      const ses = Number(r.sessions);
      const pch = Number(r.ecommercePurchases);
      const rev = Number(r.purchaseRevenue);
      return {
        年月:         `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
        來源媒介:     r.sessionSourceMedium,
        廣告活動名稱: r.sessionCampaignName,
        工作階段:     ses,
        互動工作階段: r.engagedSessions,
        活躍使用者:   r.activeUsers,
        電商購買次數: pch,
        購買收益:     Math.round(rev),
        轉換率pct:    ses > 0 ? (pch / ses * 100).toFixed(2) : '0.00',
        AOV:          pch > 0 ? Math.round(rev / pch) : 0,
      };
    });

  writeCsv('A3_monthly_campaign', rows);
}

// ── A4：每月新客來源 ────────────────────────────────────────────
async function a4NewUser() {
  console.log('⏳ A4 新客來源...');
  const raw = await runReport({
    dimensions: ['yearMonth', 'firstUserSourceMedium'],
    metrics: ['newUsers'],
    filter: hostFilter(),
    limit: 100_000,
  });

  const rows = raw.map((r) => {
    const ym = String(r.yearMonth);
    return {
      年月:         `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
      初次來源媒介: r.firstUserSourceMedium,
      新使用者:     r.newUsers,
    };
  });

  writeCsv('A4_monthly_new_user_src', rows);
}

// ── 主程式 ────────────────────────────────────────────────────
// 用法：
//   npx tsx src/monthlyAnalysis.ts         → 跑全部
//   npx tsx src/monthlyAnalysis.ts a3 a4   → 只跑指定報表
async function main() {
  const args = process.argv.slice(2).map((s) => s.toLowerCase());
  const only = args.length > 0 ? new Set(args) : null;
  const run  = (key: string) => !only || only.has(key);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ETMALL 月度分析四表（2024-01 ～ 2026-08）                 ║');
  console.log(`║   範圍：${HOSTNAME ?? '全站（含 APP）'}`.padEnd(63) + '║');
  if (only) console.log(`║   只跑：${[...only].join(', ')}`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (run('a1')) await a1Overall();
  if (run('a2')) await a2Source();
  if (run('a3')) await a3Campaign();
  if (run('a4')) await a4NewUser();

  console.log(`\n📁 輸出至 reports/ 資料夾\n`);
}

main().catch(console.error);
