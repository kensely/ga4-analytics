/**
 * A2 月度流量來源 v2
 * - 每月一次 API，僅 sessionSourceMedium 維度
 * - 每月對帳查詢（無維度）
 * - (other) 或 dataLossFromOtherRow 時，降級用逐日查詢加總可加總指標
 * 執行：npx tsx src/monthlySourceV2.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPORTS    = path.join(__dirname, '..', 'reports');

// ── 月份清單 2024-01 ～ 2026-08 ──────────────────────────────
const MONTHS: { label: string; start: string; end: string }[] = [];
for (let y = 2024; y <= 2026; y++) {
  const maxM = y === 2026 ? 8 : 12;
  for (let m = 1; m <= maxM; m++) {
    const mm      = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    MONTHS.push({
      label: `${y}-${mm}`,
      start: `${y}-${mm}-01`,
      end:   `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
    });
  }
}

// ── 型別 ─────────────────────────────────────────────────────
interface SourceRow {
  yearMonth:        string;
  sourceMedium:     string;
  activeUsers:      number;
  sessions:         number;
  engagedSessions:  number;
  purchases:        number;
  revenue:          number;
  fromDailyFallback: boolean;
}

interface CheckRow {
  yearMonth:             string;
  totalSessions:         number;
  totalActiveUsers:      number;
  sourceSumSessions:     number;
  sessionRatio:          string;
  otherActiveUsers:      number;
  otherSessions:         number;
  otherSessionsPct:      string;
  dataLossFromOtherRow:  string;
  subjectToThresholding: string;
  samplingInfo:          string;
  activeUsersNote:       string;
  quotaTokensConsumed:   number;
  quotaTokensRemaining:  number;
}

// ── API 工具 ─────────────────────────────────────────────────
async function fetchAllPages(params: any): Promise<{ rows: any[]; metadata: any; propertyQuota: any }> {
  const allRows: any[] = [];
  let offset = 0;
  let metadata: any = null;
  let propertyQuota: any = null;
  const PAGE = 100_000;

  while (true) {
    const [res] = await analyticsDataClient.runReport({ ...params, limit: PAGE, offset, returnPropertyQuota: true });
    metadata     = res.metadata;
    propertyQuota = res.propertyQuota;

    for (const r of res.rows ?? []) {
      const dim = (i: number) => r.dimensionValues?.[i]?.value ?? '';
      const met = (i: number) => r.metricValues?.[i]?.value ?? '0';
      allRows.push({ dim, met });
    }

    const got = res.rows?.length ?? 0;
    offset += got;
    if (got === 0 || offset >= (res.rowCount ?? 0)) break;
  }

  return { rows: allRows, metadata, propertyQuota };
}

// ── 月查詢：來源明細 ──────────────────────────────────────────
async function fetchMonthSource(start: string, end: string) {
  return fetchAllPages({
    property:   `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });
}

// ── 月查詢：對帳（無維度）────────────────────────────────────
async function fetchMonthTotal(start: string, end: string) {
  const [res] = await analyticsDataClient.runReport({
    property:   `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    returnPropertyQuota: true,
  } as any);
  return {
    sessions:     parseInt(res.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
    activeUsers:  parseInt(res.rows?.[0]?.metricValues?.[1]?.value ?? '0'),
    propertyQuota: res.propertyQuota,
  };
}

// ── 日查詢降級（可加總指標）──────────────────────────────────
async function fetchDailyFallback(start: string, end: string): Promise<Map<string, { sessions: number; engagedSessions: number; purchases: number; revenue: number }>> {
  const { rows } = await fetchAllPages({
    property:   `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'date' }, { name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  });

  const agg = new Map<string, { sessions: number; engagedSessions: number; purchases: number; revenue: number }>();
  for (const r of rows) {
    const sm  = r.dim(1);
    if (sm === '(other)') continue;
    const cur = agg.get(sm) ?? { sessions: 0, engagedSessions: 0, purchases: 0, revenue: 0 };
    cur.sessions        += parseInt(r.met(0));
    cur.engagedSessions += parseInt(r.met(1));
    cur.purchases       += parseInt(r.met(2));
    cur.revenue         += parseFloat(r.met(3));
    agg.set(sm, cur);
  }
  return agg;
}

// ── CSV ──────────────────────────────────────────────────────
function esc(v: string | number) {
  const s = String(v);
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return '';
  const h = Object.keys(rows[0]);
  return [h.join(','), ...rows.map((r) => h.map((k) => esc(r[k])).join(','))].join('\n');
}

// ── 主程式 ───────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   A2 月度流量來源 v2（每月個別查詢）                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const sourceRows: SourceRow[] = [];
  const checkRows:  CheckRow[]  = [];

  // 收斂報告用
  const otherMonths:  string[] = [];
  const ratioOff:     string[] = [];
  const threshMonths: string[] = [];

  let totalTokensUsed = 0;

  for (const { label, start, end } of MONTHS) {
    process.stdout.write(`  ${label} ... `);

    // ① 來源明細
    const { rows: srcRows, metadata, propertyQuota } = await fetchMonthSource(start, end);

    const tokensConsumed  = propertyQuota?.tokensPerHour?.consumed  ?? 0;
    const tokensRemaining = propertyQuota?.tokensPerHour?.remaining ?? 0;
    totalTokensUsed += tokensConsumed;

    const dataLoss     = metadata?.dataLossFromOtherRow ?? false;
    const thresholding = metadata?.subjectToThresholding ?? false;
    const sampling     = (metadata?.samplingMetadatas ?? [])
      .map((s: any) => `${s.samplesReadCount}/${s.samplingSpaceSize}`).join('; ') || '—';

    const hasOther     = srcRows.some((r) => r.dim(0) === '(other)');
    const needFallback = hasOther || dataLoss;

    // ② 對帳（無維度）
    const total = await fetchMonthTotal(start, end);

    // ③ (other) 列數據
    const otherRow   = srcRows.find((r) => r.dim(0) === '(other)');
    const otherSess  = otherRow ? parseInt(otherRow.met(1)) : 0;
    const otherAU    = otherRow ? parseInt(otherRow.met(0)) : 0;
    const otherPct   = total.sessions > 0 ? (otherSess / total.sessions * 100).toFixed(2) : '0.00';

    // ④ 降級查詢
    let fallbackMap: Map<string, any> | null = null;
    if (needFallback) {
      process.stdout.write('[日降級] ');
      fallbackMap = await fetchDailyFallback(start, end);
    }

    // ⑤ 整理來源列
    let activeUsersNote = '';
    const nonOtherRows = srcRows.filter((r) => r.dim(0) !== '(other)');

    for (const r of nonOtherRows) {
      const sm = r.dim(0);
      let sessions        = parseInt(r.met(1));
      let engagedSessions = parseInt(r.met(2));
      let purchases       = parseInt(r.met(3));
      let revenue         = parseFloat(r.met(4));
      const activeUsers   = parseInt(r.met(0)); // 月查詢，不加總

      if (fallbackMap) {
        const fb = fallbackMap.get(sm);
        if (fb) {
          sessions        = fb.sessions;
          engagedSessions = fb.engagedSessions;
          purchases       = fb.purchases;
          revenue         = fb.revenue;
        }
        if (hasOther) activeUsersNote = 'activeUsers 含 (other)';
      }

      sourceRows.push({
        yearMonth: label, sourceMedium: sm,
        activeUsers, sessions, engagedSessions, purchases, revenue,
        fromDailyFallback: !!fallbackMap,
      });
    }

    // ⑥ 對帳數字
    const srcSumSessions = sourceRows.filter((r) => r.yearMonth === label).reduce((s, r) => s + r.sessions, 0);
    const ratio = total.sessions > 0 ? (srcSumSessions / total.sessions).toFixed(4) : '—';
    const ratioNum = parseFloat(ratio);

    checkRows.push({
      yearMonth:             label,
      totalSessions:         total.sessions,
      totalActiveUsers:      total.activeUsers,
      sourceSumSessions:     srcSumSessions,
      sessionRatio:          ratio,
      otherActiveUsers:      otherAU,
      otherSessions:         otherSess,
      otherSessionsPct:      otherPct,
      dataLossFromOtherRow:  String(dataLoss),
      subjectToThresholding: String(thresholding),
      samplingInfo:          sampling,
      activeUsersNote,
      quotaTokensConsumed:   tokensConsumed,
      quotaTokensRemaining:  tokensRemaining,
    });

    // 收斂
    if (hasOther)      otherMonths.push(`${label}(${otherPct}%)`);
    if (thresholding)  threshMonths.push(label);
    if (!isNaN(ratioNum) && Math.abs(ratioNum - 1) > 0.02) ratioOff.push(`${label}(${ratio})`);

    console.log(`✅  sessions=${total.sessions.toLocaleString()} ratio=${ratio} quota剩=${tokensRemaining}`);

    // 配額保護：剩餘 < 500 時暫停 10 秒
    if (tokensRemaining < 500) {
      console.log('  ⚠ 配額偏低，等待 10 秒...');
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }

  // ── 輸出 CSV ──
  const srcCsvRows = sourceRows.map((r) => ({
    '年月(YYYY-MM)':     r.yearMonth,
    '來源媒介':          r.sourceMedium,
    '活躍使用者':        r.activeUsers,
    '工作階段':          r.sessions,
    '互動工作階段':      r.engagedSessions,
    '電商購買次數':      r.purchases,
    '購買收益':          Math.round(r.revenue),
    '逐日降級':          r.fromDailyFallback ? 'Y' : '',
  })).sort((a, b) => {
    if (a['年月(YYYY-MM)'] < b['年月(YYYY-MM)']) return -1;
    if (a['年月(YYYY-MM)'] > b['年月(YYYY-MM)']) return 1;
    return b['工作階段'] - a['工作階段'];
  });

  const chkCsvRows = checkRows.map((r) => ({
    '年月':                  r.yearMonth,
    '全站工作階段':           r.totalSessions,
    '來源加總工作階段':       r.sourceSumSessions,
    '工作階段比值':           r.sessionRatio,
    '全站活躍使用者':         r.totalActiveUsers,
    '(other)列活躍使用者':   r.otherActiveUsers,
    '(other)列工作階段':     r.otherSessions,
    '(other)工作階段占比pct': r.otherSessionsPct,
    'dataLossFromOtherRow':  r.dataLossFromOtherRow,
    'subjectToThresholding': r.subjectToThresholding,
    '取樣資訊':               r.samplingInfo,
    'activeUsers備註':        r.activeUsersNote,
    'quotaTokensConsumed':   r.quotaTokensConsumed,
    'quotaTokensRemaining':  r.quotaTokensRemaining,
  }));

  const BOM = '﻿';
  fs.writeFileSync(path.join(REPORTS, 'A2_monthly_source_v2.csv'), BOM + toCsv(srcCsvRows), 'utf-8');
  fs.writeFileSync(path.join(REPORTS, 'A2_check.csv'),             BOM + toCsv(chkCsvRows), 'utf-8');

  console.log(`\n✅ A2_monthly_source_v2.csv — ${srcCsvRows.length.toLocaleString()} 筆`);
  console.log(`✅ A2_check.csv             — ${chkCsvRows.length} 筆`);

  // ── 收斂報告 ──
  console.log('\n╔══ 收斂報告 ══════════════════════════════════════════════════╗');
  console.log(`  (other) 出現月份（${otherMonths.length} 個）：${otherMonths.join(', ') || '無'}`);
  console.log(`  比值偏離 >2% 月份（${ratioOff.length} 個）：${ratioOff.join(', ') || '無'}`);
  console.log(`  Thresholding 月份（${threshMonths.length} 個）：${threshMonths.join(', ') || '無'}`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);
