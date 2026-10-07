import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import {
  fetchYesterdayReport,
  fetchLastMonthSameDayReport,
  fetchThisMonthReport,
  fetchLastMonthSamePeriodReport,
  fetchDailyTotalsSince,
  fetchGoogleChannelYesterday,
  fetchGoogleChannelLastMonthSameDay,
  fetchGoogleChannelThisMonth,
  fetchGoogleChannelLastMonthSamePeriod,
  fetchGoogleDailySince,
  fetchGoogleDailyByMediumSince,
  fetchOrganicLandingPages,
  fetchOrganicByDevice,
  fetchOrganicNewVsReturn,
  fetchPlatformDailySince,
  fetchPlatformReport,
  fetchEcommerceDailySince,
  fetchEcommerceReport,
  fetchBehaviorOverview,
  fetchFunnelData,
  fetchTopExitPages,
  fetchTopPagesByEngagement,
  fetchMonthlyUsers,
  fetchHourlyTraffic,
  fetchChannelUsers,
  fetchChannelMonthlyTrend,
  fetchChannelByItemCategory,
  fetchGoogleEcommerce,
  fetchPromotionClicks,
  fetchAiTraffic,
  fetchAiLandingPages,
  fetchSiteSearch,
  getDateRanges,
  DailyTotalRow,
  GoogleChannelRow,
  GoogleDailyRow,
  GoogleDailyByMediumRow,
  OrganicLandingPageRow,
  OrganicDeviceRow,
  OrganicNewVsReturnRow,
  PlatformRow,
  PlatformDailyRow,
  EcommerceDailyRow,
  EcommerceRow,
  BehaviorOverviewRow,
  FunnelRow,
  ExitPageRow,
  TopPageRow,
  MonthlyUsersRow,
  HourlyRow,
  ChannelRow,
  ChannelMonthlyRow,
  CategoryChannelRow,
  GoogleEcomRow,
  PromotionClickRow,
} from './fetchReport.js';
import { compareMom, formatMomTable, MomRow } from './momCompare.js';
import { generateInsight } from './aiInsight.js';
import { generateHtml, generateTodayHtml, generateChannelTrendHtml, generateCategoryHtml, generatePromotionHtml, generateAiHtml, generateSearchHtml, CategoryTabData } from './generateHtml.js';

dotenv.config();

// ── 顏色定義 ────────────────────────────────────────────────
const COLOR = {
  headerBg: '1F3864',   // 深藍
  headerFont: 'FFFFFF', // 白字
  rowOdd: 'EEF2F8',     // 淺藍灰
  rowEven: 'FFFFFF',    // 白
  rise: 'C6EFCE',       // 淺綠（上升）
  fall: 'FFCCCC',       // 淺紅（下降）
  riseFont: '276221',   // 深綠字
  fallFont: '9C0006',   // 深紅字
  border: 'B8C4D8',     // 邊框灰藍
};

function border(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.BorderStyle = 'thin';
  const color = { argb: COLOR.border };
  return { top: { style: side, color }, bottom: { style: side, color }, left: { style: side, color }, right: { style: side, color } };
}

function applyHeader(row: ExcelJS.Row, colCount: number) {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: COLOR.headerFont }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = border();
  }
}

function applyDataRow(row: ExcelJS.Row, colCount: number, isOdd: boolean) {
  row.height = 18;
  const bg = isOdd ? COLOR.rowOdd : COLOR.rowEven;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
    cell.border = border();
    cell.font = { size: 10 };
  }
}

function applyPctCell(cell: ExcelJS.Cell, value: number) {
  cell.value = value;
  cell.numFmt = '0.0%';
  if (value > 0) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.rise } };
    cell.font = { size: 10, bold: true, color: { argb: COLOR.riseFont } };
  } else if (value < 0) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fall } };
    cell.font = { size: 10, bold: true, color: { argb: COLOR.fallFont } };
  }
}

// ── 每日總流量頁籤 ───────────────────────────────────────────
function buildTotalSheet(wb: ExcelJS.Workbook, rows: DailyTotalRow[]) {
  const ws = wb.addWorksheet('每日總流量');
  ws.columns = [
    { header: '日期', key: 'date', width: 14 },
    { header: '總人數', key: 'users', width: 14 },
    { header: 'DoD%', key: 'dod', width: 12 },
  ];

  applyHeader(ws.getRow(1), 3);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'C1' };

  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const dod = prev && prev.users > 0 ? (row.users - prev.users) / prev.users : null;
    const exRow = ws.addRow({ date: row.date, users: row.users, dod: '' });
    applyDataRow(exRow, 3, i % 2 === 0);
    exRow.getCell(1).numFmt = '@';
    exRow.getCell(2).numFmt = '#,##0';
    if (dod !== null) applyPctCell(exRow.getCell(3), dod);
  });
}

// ── MOM 渠道比較頁籤 ─────────────────────────────────────────
function buildMomSheet(wb: ExcelJS.Workbook, sheetName: string, rows: MomRow[]) {
  const ws = wb.addWorksheet(sheetName);
  const headers = ['來源', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '前期用戶', '用戶MOM%', '當期新用戶', '新用戶MOM%'];
  const widths =  [30, 14, 14, 10, 12, 12, 10, 13, 11];
  ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));

  applyHeader(ws.getRow(1), headers.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };

  rows.forEach((row, i) => {
    const exRow = ws.addRow([
      row.sessionSource,
      row.current.sessions,
      row.previous.sessions,
      '',
      row.current.users,
      row.previous.users,
      '',
      row.current.newUsers,
      '',
    ]);
    applyDataRow(exRow, headers.length, i % 2 === 0);
    exRow.getCell(2).numFmt = '#,##0';
    exRow.getCell(3).numFmt = '#,##0';
    exRow.getCell(5).numFmt = '#,##0';
    exRow.getCell(6).numFmt = '#,##0';
    exRow.getCell(8).numFmt = '#,##0';
    applyPctCell(exRow.getCell(4), row.mom.sessions / 100);
    applyPctCell(exRow.getCell(7), row.mom.users / 100);
    applyPctCell(exRow.getCell(9), row.mom.newUsers / 100);
  });
}

// ── Google 媒介每日趨勢（各 medium 折線）──────────────────────
async function buildGoogleMediumTrendSheet(wb: ExcelJS.Workbook, rows: GoogleDailyByMediumRow[]) {
  const ws = wb.addWorksheet('Google媒介每日趨勢');

  // 取出所有日期（不重複）與媒介（依總量排序）
  const allDates  = [...new Set(rows.map((r) => r.date))].sort();
  const mediumTotals = new Map<string, number>();
  rows.forEach((r) => mediumTotals.set(r.medium, (mediumTotals.get(r.medium) ?? 0) + r.sessions));
  const allMediums = [...mediumTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);

  // 建立 date -> medium -> sessions 的查詢 map
  const lookup = new Map<string, Map<string, number>>();
  rows.forEach((r) => {
    if (!lookup.has(r.date)) lookup.set(r.date, new Map());
    lookup.get(r.date)!.set(r.medium, r.sessions);
  });

  // ── 表格 ──
  ws.columns = [
    { header: '日期', key: 'date', width: 14 },
    ...allMediums.map((m) => ({ header: m, width: 14 })),
  ];
  applyHeader(ws.getRow(1), allMediums.length + 1);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  allDates.forEach((date, i) => {
    const vals = allMediums.map((m) => lookup.get(date)?.get(m) ?? 0);
    const exRow = ws.addRow([date, ...vals]);
    applyDataRow(exRow, allMediums.length + 1, i % 2 === 0);
    exRow.getCell(1).numFmt = '@';
    for (let c = 2; c <= allMediums.length + 1; c++) exRow.getCell(c).numFmt = '#,##0';
  });

  // ── 折線圖 ──
  try {
    const W = 1200, H = 520;
    const padL = 80, padR = 160, padT = 50, padB = 70;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // 取前 6 大媒介繪圖（避免太亂）
    const topMediums = allMediums.slice(0, 6);
    const COLORS = ['#2E75B6','#ED7D31','#70AD47','#FFC000','#A550A7','#FF0000'];

    // 計算 y 範圍（只看 top mediums）
    const allVals = rows
      .filter((r) => topMediums.includes(r.medium))
      .map((r) => r.sessions);
    const maxVal = Math.max(...allVals, 1);
    const minVal = 0;
    const range  = maxVal - minVal;

    const toX = (i: number) => padL + (i / (allDates.length - 1 || 1)) * chartW;
    const toY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

    const lines = topMediums.map((medium, mi) => {
      const color = COLORS[mi];
      const pts = allDates.map((date, i) => {
        const v = lookup.get(date)?.get(medium) ?? 0;
        return `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`;
      }).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" opacity="0.9"/>`;
    }).join('\n');

    // X 軸：每月 1 日
    const xLabels = allDates.reduce<string>((acc, date, i) => {
      if (date.endsWith('-01') || i === 0) {
        const x = toX(i).toFixed(1);
        return acc +
          `<text x="${x}" y="${padT + chartH + 20}" text-anchor="middle" font-size="11" fill="#555">${date.slice(0, 7)}</text>
           <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + chartH}" stroke="#e0e0e0" stroke-width="1"/>`;
      }
      return acc;
    }, '');

    // Y 軸
    const yLabels = Array.from({ length: 6 }, (_, i) => {
      const v = (range / 5) * i;
      const y = toY(v).toFixed(1);
      return `<text x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="#555">${Math.round(v).toLocaleString()}</text>
              <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
    }).join('');

    // 圖例
    const legend = topMediums.map((medium, mi) => {
      const lx = W - padR + 10;
      const ly = padT + mi * 28;
      return `<rect x="${lx}" y="${ly}" width="16" height="4" fill="${COLORS[mi]}"/>
              <text x="${lx + 22}" y="${ly + 5}" font-size="12" fill="#333">${medium}</text>`;
    }).join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font-family:Arial,sans-serif">
      <text x="${(W - padR) / 2 + padL / 2}" y="28" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F3864">Google 各媒介每日工作階段趨勢（2026年）</text>
      ${yLabels}
      ${lines}
      ${xLabels}
      ${legend}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const imageId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: allMediums.length + 2, row: 1 },
      ext: { width: W, height: H },
    });
  } catch (e) {
    console.warn('⚠️  Google媒介圖表產生失敗：', e);
  }
}

// ── 平台每日趨勢頁籤（Web / mWeb / App 折線圖）──────────────
async function buildPlatformDailyTrendSheet(wb: ExcelJS.Workbook, rows: PlatformDailyRow[]) {
  const ws = wb.addWorksheet('平台每日趨勢');
  ws.columns = [
    { header: '日期',     key: 'date', width: 14 },
    { header: 'Web',      key: 'web',  width: 13 },
    { header: 'mWeb',     key: 'mweb', width: 13 },
    { header: 'App',      key: 'app',  width: 13 },
  ];
  applyHeader(ws.getRow(1), 4);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row, i) => {
    const exRow = ws.addRow([row.date, row.web, row.mweb, row.app]);
    applyDataRow(exRow, 4, i % 2 === 0);
    exRow.getCell(1).numFmt = '@';
    [2, 3, 4].forEach((c) => { exRow.getCell(c).numFmt = '#,##0'; });
  });

  // 折線圖
  try {
    const W = 1200, H = 500;
    const padL = 80, padR = 160, padT = 50, padB = 70;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const COLORS = ['#2E75B6', '#ED7D31', '#70AD47'];
    const datasets: { label: string; vals: number[]; color: string }[] = [
      { label: 'Web',  vals: rows.map((r) => r.web),  color: COLORS[0] },
      { label: 'mWeb', vals: rows.map((r) => r.mweb), color: COLORS[1] },
      { label: 'App',  vals: rows.map((r) => r.app),  color: COLORS[2] },
    ];

    const allVals = datasets.flatMap((d) => d.vals);
    const maxVal = Math.max(...allVals, 1);
    const toX = (i: number) => padL + (i / (rows.length - 1 || 1)) * chartW;
    const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;

    const lines = datasets.map(({ vals, color, label }) => {
      const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
      const legendIdx = datasets.findIndex((d) => d.label === label);
      const lx = W - padR + 10, ly = padT + legendIdx * 28;
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.9"/>
              <rect x="${lx}" y="${ly}" width="16" height="4" fill="${color}"/>
              <text x="${lx + 22}" y="${ly + 5}" font-size="12" fill="#333">${label}</text>`;
    }).join('\n');

    const xLabels = rows.reduce<string>((acc, r, i) => {
      if (r.date.endsWith('-01') || i === 0) {
        const x = toX(i).toFixed(1);
        return acc + `<text x="${x}" y="${padT + chartH + 20}" text-anchor="middle" font-size="11" fill="#555">${r.date.slice(0, 7)}</text>
                      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + chartH}" stroke="#e0e0e0" stroke-width="1"/>`;
      }
      return acc;
    }, '');

    const yLabels = Array.from({ length: 6 }, (_, i) => {
      const v = (maxVal / 5) * i;
      const y = toY(v).toFixed(1);
      return `<text x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="#555">${Math.round(v).toLocaleString()}</text>
              <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font-family:Arial,sans-serif">
      <text x="${(W - padR + padL) / 2}" y="28" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F3864">平台每日工作階段趨勢（2026年）</text>
      ${yLabels}${lines}${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const imageId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 5, row: 1 }, ext: { width: W, height: H } });
  } catch (e) {
    console.warn('⚠️  平台趨勢圖表失敗：', e);
  }
}

// ── 平台 MOM 比較頁籤 ─────────────────────────────────────────
function buildPlatformMomSheet(
  wb: ExcelJS.Workbook,
  curDaily: PlatformRow[], prevDaily: PlatformRow[],
  curMonth: PlatformRow[], prevMonth: PlatformRow[],
  dates: ReturnType<typeof getDateRanges>
) {
  const ws = wb.addWorksheet('平台MOM比較');
  const headers = ['平台', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '前期用戶', '用戶MOM%', '當期新用戶', '新用戶MOM%'];
  const widths  = [10, 14, 14, 10, 12, 12, 10, 13, 11];
  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 1 : 0) : (c - p) / p;
  const numFmt = '#,##0';

  const addSection = (title: string, cur: PlatformRow[], prev: PlatformRow[]) => {
    const titleRow = ws.addRow([title]);
    titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: COLOR.headerFont } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    titleRow.height = 20;
    ws.mergeCells(`A${titleRow.number}:I${titleRow.number}`);

    const hdr = ws.addRow(headers);
    ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
    applyHeader(hdr, headers.length);

    const prevMap = new Map(prev.map((r) => [r.platform, r]));
    cur.forEach((row, i) => {
      const p = prevMap.get(row.platform) ?? { platform: row.platform, sessions: 0, users: 0, newUsers: 0 };
      const exRow = ws.addRow([
        row.platform,
        row.sessions, p.sessions, '',
        row.users,    p.users,    '',
        row.newUsers, '',
      ]);
      applyDataRow(exRow, headers.length, i % 2 === 0);
      [2, 3, 5, 6, 8].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
      applyPctCell(exRow.getCell(4), mom(row.sessions, p.sessions));
      applyPctCell(exRow.getCell(7), mom(row.users, p.users));
      applyPctCell(exRow.getCell(9), mom(row.newUsers, p.newUsers));
    });
    ws.addRow([]);
  };

  addSection(`每日：${dates.yesterday} vs ${dates.lastMonthSameDay}`, curDaily, prevDaily);
  addSection(`月累計：${dates.thisMonthStart}～${dates.thisMonthEnd} vs ${dates.lastMonthStart}～${dates.lastMonthEnd}`, curMonth, prevMonth);
}

// ── 電商每日趨勢頁籤 ─────────────────────────────────────────
async function buildEcommerceDailySheet(wb: ExcelJS.Workbook, rows: EcommerceDailyRow[], cur: EcommerceRow, prev: EcommerceRow, monthCur: EcommerceRow, monthPrev: EcommerceRow, dates: ReturnType<typeof getDateRanges>) {
  const ws = wb.addWorksheet('電商每日趨勢');
  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 1 : 0) : (c - p) / p;

  // MOM 摘要列
  const summaryHeaders = ['指標', '昨日', '上月同天', 'MOM%', '本月累計', '上月同期', 'MOM%'];
  ws.columns = summaryHeaders.map((h, i) => ({ header: h, width: [16, 14, 14, 10, 14, 14, 10][i] }));
  applyHeader(ws.getRow(1), 7);

  const metrics: { label: string; cur: number; prev: number; mCur: number; mPrev: number; fmt: string }[] = [
    { label: '工作階段',    cur: cur.sessions,     prev: prev.sessions,     mCur: monthCur.sessions,     mPrev: monthPrev.sessions,     fmt: '#,##0' },
    { label: '加入購物車',  cur: cur.addToCarts,   prev: prev.addToCarts,   mCur: monthCur.addToCarts,   mPrev: monthPrev.addToCarts,   fmt: '#,##0' },
    { label: '交易次數',    cur: cur.transactions, prev: prev.transactions, mCur: monthCur.transactions, mPrev: monthPrev.transactions, fmt: '#,##0' },
    { label: '總收益',      cur: cur.revenue,      prev: prev.revenue,      mCur: monthCur.revenue,      mPrev: monthPrev.revenue,      fmt: '#,##0.00' },
    { label: '電商轉換率',  cur: cur.cvr / 100,    prev: prev.cvr / 100,    mCur: monthCur.cvr / 100,    mPrev: monthPrev.cvr / 100,    fmt: '0.00%' },
    { label: '平均訂單金額', cur: cur.aov,          prev: prev.aov,          mCur: monthCur.aov,          mPrev: monthPrev.aov,          fmt: '#,##0.00' },
  ];

  metrics.forEach((m, i) => {
    const exRow = ws.addRow([m.label, m.cur, m.prev, '', m.mCur, m.mPrev, '']);
    applyDataRow(exRow, 7, i % 2 === 0);
    [2, 3, 5, 6].forEach((c) => { exRow.getCell(c).numFmt = m.fmt; });
    applyPctCell(exRow.getCell(4), mom(m.cur, m.prev));
    applyPctCell(exRow.getCell(7), mom(m.mCur, m.mPrev));
  });

  ws.addRow([]);

  // 每日明細表
  const detailHeaders = ['日期', '工作階段', '加入購物車', '交易次數', '總收益', '轉換率CVR', '平均訂單AOV'];
  const detailRow = ws.addRow(detailHeaders);
  applyHeader(detailRow, 7);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row, i) => {
    const exRow = ws.addRow([row.date, row.sessions, row.addToCarts, row.transactions, row.revenue, row.cvr / 100, row.aov]);
    applyDataRow(exRow, 7, i % 2 === 0);
    exRow.getCell(1).numFmt = '@';
    exRow.getCell(2).numFmt = '#,##0';
    exRow.getCell(3).numFmt = '#,##0';
    exRow.getCell(4).numFmt = '#,##0';
    exRow.getCell(5).numFmt = '#,##0.00';
    exRow.getCell(6).numFmt = '0.00%';
    exRow.getCell(7).numFmt = '#,##0.00';
  });

  // 折線圖（Revenue + CVR 雙軸）
  try {
    const W = 1200, H = 480, padL = 80, padR = 80, padT = 50, padB = 70;
    const chartW = W - padL - padR, chartH = H - padT - padB;

    const revenues = rows.map((r) => r.revenue);
    const cvrs     = rows.map((r) => r.cvr);
    const maxRev   = Math.max(...revenues, 1);
    const maxCvr   = Math.max(...cvrs, 0.1);

    const toX = (i: number) => padL + (i / (rows.length - 1 || 1)) * chartW;

    const revLine = rows.map((r, i) => `${toX(i).toFixed(1)},${(padT + chartH - (r.revenue / maxRev) * chartH).toFixed(1)}`).join(' ');
    const cvrLine = rows.map((r, i) => `${toX(i).toFixed(1)},${(padT + chartH - (r.cvr / maxCvr) * chartH).toFixed(1)}`).join(' ');

    const xLabels = rows.reduce<string>((acc, r, i) => {
      if (r.date.endsWith('-01') || i === 0) {
        const x = toX(i).toFixed(1);
        return acc + `<text x="${x}" y="${padT + chartH + 20}" text-anchor="middle" font-size="11" fill="#555">${r.date.slice(0, 7)}</text>
                      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + chartH}" stroke="#e0e0e0" stroke-width="1"/>`;
      }
      return acc;
    }, '');

    const yRevLabels = Array.from({ length: 6 }, (_, i) => {
      const v = (maxRev / 5) * i;
      const y = (padT + chartH - (v / maxRev) * chartH).toFixed(1);
      return `<text x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="#2E75B6">${Math.round(v).toLocaleString()}</text>
              <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
    }).join('');

    const yCvrLabels = Array.from({ length: 6 }, (_, i) => {
      const v = (maxCvr / 5) * i;
      const y = (padT + chartH - (v / maxCvr) * chartH).toFixed(1);
      return `<text x="${W - padR + 8}" y="${y}" dominant-baseline="middle" font-size="10" fill="#70AD47">${v.toFixed(1)}%</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font-family:Arial,sans-serif">
      <text x="${W / 2}" y="28" text-anchor="middle" font-size="15" font-weight="bold" fill="#1F3864">電商每日趨勢：總收益 &amp; 轉換率（2026年）</text>
      ${yRevLabels}${yCvrLabels}
      <polyline points="${revLine}" fill="none" stroke="#2E75B6" stroke-width="2.5"/>
      <polyline points="${cvrLine}" fill="none" stroke="#70AD47" stroke-width="2" stroke-dasharray="6,3"/>
      ${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <rect x="${padL}" y="${H - 22}" width="16" height="4" fill="#2E75B6"/>
      <text x="${padL + 20}" y="${H - 16}" font-size="12" fill="#333">總收益（左軸）</text>
      <line x1="${padL + 120}" y1="${H - 19}" x2="${padL + 136}" y2="${H - 19}" stroke="#70AD47" stroke-width="2" stroke-dasharray="4,2"/>
      <text x="${padL + 140}" y="${H - 16}" font-size="12" fill="#333">轉換率CVR（右軸）</text>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const imageId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 8, row: 1 }, ext: { width: W, height: H } });
  } catch (e) {
    console.warn('⚠️  電商圖表失敗：', e);
  }
}

// ── Google Organic 深度分析頁籤 ──────────────────────────────
function buildOrganicAnalysisSheet(
  wb: ExcelJS.Workbook,
  landingCur: OrganicLandingPageRow[],
  landingPrev: OrganicLandingPageRow[],
  deviceCur: OrganicDeviceRow[],
  devicePrev: OrganicDeviceRow[],
  newVsReturnCur: OrganicNewVsReturnRow[],
  newVsReturnPrev: OrganicNewVsReturnRow[],
  dates: ReturnType<typeof getDateRanges>
) {
  const ws = wb.addWorksheet('Google Organic分析');
  ws.columns = [{ width: 45 }, { width: 13 }, { width: 13 }, { width: 10 }, { width: 13 }, { width: 13 }, { width: 10 }];

  const addSectionTitle = (title: string) => {
    ws.addRow([]);
    const r = ws.addRow([title]);
    r.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.headerFont } };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    r.getCell(1).alignment = { vertical: 'middle' };
    r.height = 22;
    ws.mergeCells(`A${r.number}:G${r.number}`);
  };

  const addSubHeader = (labels: string[]) => {
    const r = ws.addRow(labels);
    applyHeader(r, labels.length);
  };

  const numFmt = '#,##0';
  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 1 : 0) : (c - p) / p;

  // ── 1. 登陸頁面 ──
  addSectionTitle(`▌ 登陸頁面分析（用戶從哪個頁面進來）`);
  addSubHeader(['頁面路徑', `本期工作階段\n${dates.thisMonthStart}～${dates.thisMonthEnd}`, `前期工作階段\n${dates.lastMonthStart}～${dates.lastMonthEnd}`, 'MOM%', '本期用戶', '前期用戶', '用戶MOM%']);

  const prevLandingMap = new Map(landingPrev.map((r) => [r.landingPage, r]));
  landingCur.forEach((row, i) => {
    const prev = prevLandingMap.get(row.landingPage);
    const exRow = ws.addRow([
      row.landingPage,
      row.sessions, prev?.sessions ?? 0, '',
      row.users, prev?.users ?? 0, '',
    ]);
    applyDataRow(exRow, 7, i % 2 === 0);
    [2, 3, 5, 6].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
    applyPctCell(exRow.getCell(4), mom(row.sessions, prev?.sessions ?? 0));
    applyPctCell(exRow.getCell(7), mom(row.users, prev?.users ?? 0));
  });

  // ── 2. 裝置分佈 ──
  addSectionTitle(`▌ 裝置分佈（用戶用什麼裝置來的）`);
  addSubHeader(['裝置類型', '本期工作階段', '前期工作階段', 'MOM%', '本期用戶', '前期用戶', '用戶MOM%']);

  const prevDeviceMap = new Map(devicePrev.map((r) => [r.device, r]));
  const totalDeviceSessions = deviceCur.reduce((s, r) => s + r.sessions, 0);
  deviceCur.forEach((row, i) => {
    const prev = prevDeviceMap.get(row.device);
    const pct  = totalDeviceSessions > 0 ? `${((row.sessions / totalDeviceSessions) * 100).toFixed(1)}%` : '';
    const exRow = ws.addRow([
      `${row.device}  (${pct})`,
      row.sessions, prev?.sessions ?? 0, '',
      row.users, prev?.users ?? 0, '',
    ]);
    applyDataRow(exRow, 7, i % 2 === 0);
    [2, 3, 5, 6].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
    applyPctCell(exRow.getCell(4), mom(row.sessions, prev?.sessions ?? 0));
    applyPctCell(exRow.getCell(7), mom(row.users, prev?.users ?? 0));
  });

  // ── 3. 新訪客 vs 回訪 ──
  addSectionTitle(`▌ 新訪客 vs 回訪用戶`);
  addSubHeader(['類型', '本期工作階段', '前期工作階段', 'MOM%', '本期用戶', '前期用戶', '用戶MOM%']);

  const prevNvrMap = new Map(newVsReturnPrev.map((r) => [r.type, r]));
  const totalNvrSessions = newVsReturnCur.reduce((s, r) => s + r.sessions, 0);
  const typeLabel: Record<string, string> = { new: '🆕 新訪客', returning: '🔁 回訪用戶' };
  newVsReturnCur.forEach((row, i) => {
    const prev = prevNvrMap.get(row.type);
    const pct  = totalNvrSessions > 0 ? `${((row.sessions / totalNvrSessions) * 100).toFixed(1)}%` : '';
    const label = typeLabel[row.type] ?? row.type;
    const exRow = ws.addRow([
      `${label}  (${pct})`,
      row.sessions, prev?.sessions ?? 0, '',
      row.users, prev?.users ?? 0, '',
    ]);
    applyDataRow(exRow, 7, i % 2 === 0);
    [2, 3, 5, 6].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
    applyPctCell(exRow.getCell(4), mom(row.sessions, prev?.sessions ?? 0));
    applyPctCell(exRow.getCell(7), mom(row.users, prev?.users ?? 0));
  });
}

// ── Google 渠道分析頁籤 ──────────────────────────────────────
function calcGoogleMom(cur: GoogleChannelRow[], prev: GoogleChannelRow[]) {
  const prevMap = new Map(prev.map((r) => [r.medium, r]));
  const allMediums = new Set([...cur.map((r) => r.medium), ...prev.map((r) => r.medium)]);
  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 1 : 0) : (c - p) / p;

  return [...allMediums].map((medium) => {
    const c = cur.find((r) => r.medium === medium) ?? { medium, sessions: 0, users: 0, newUsers: 0 };
    const p = prevMap.get(medium) ?? { medium, sessions: 0, users: 0, newUsers: 0 };
    return { medium, cur: c, prev: p, mom: { sessions: mom(c.sessions, p.sessions), users: mom(c.users, p.users), newUsers: mom(c.newUsers, p.newUsers) } };
  }).sort((a, b) => b.cur.sessions - a.cur.sessions);
}

function buildGoogleSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  daily: { cur: GoogleChannelRow[]; prev: GoogleChannelRow[] },
  monthly: { cur: GoogleChannelRow[]; prev: GoogleChannelRow[] },
  dates: ReturnType<typeof getDateRanges>
) {
  const ws = wb.addWorksheet(sheetName);

  // 標題行
  const titleRow = ws.addRow([`Google 渠道分析　｜　每日：${dates.yesterday} vs ${dates.lastMonthSameDay}　／　月累計：${dates.thisMonthStart}～${dates.thisMonthEnd} vs ${dates.lastMonthStart}～${dates.lastMonthEnd}`]);
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.headerFont } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
  titleRow.height = 24;
  ws.mergeCells('A1:L1');

  // 欄位群組標題
  const groupRow = ws.addRow(['', '── 每日比較 ──', '', '', '', '', '── 月累計比較 ──', '', '', '', '', '']);
  groupRow.height = 18;
  ['B2', 'G2'].forEach((addr) => {
    const cell = ws.getCell(addr);
    cell.font = { bold: true, size: 10, color: { argb: '1F3864' } };
    cell.alignment = { horizontal: 'center' };
  });
  ws.mergeCells('B2:F2');
  ws.mergeCells('G2:L2');

  // 欄位標題
  const headers = ['渠道 (Medium)', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '用戶MOM%', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '用戶MOM%', '當期新用戶'];
  const widths =   [18, 14, 14, 10, 12, 10, 14, 14, 10, 12, 10, 12];
  ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
  const hdrRow = ws.getRow(3);
  hdrRow.values = ['渠道 (Medium)', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '用戶MOM%', '當期工作階段', '前期工作階段', 'MOM%', '當期用戶', '用戶MOM%', '當期新用戶'];
  applyHeader(hdrRow, headers.length);
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  const dailyRows = calcGoogleMom(daily.cur, daily.prev);
  const monthlyMap = new Map(calcGoogleMom(monthly.cur, monthly.prev).map((r) => [r.medium, r]));
  const numFmt = '#,##0';

  dailyRows.forEach((d, i) => {
    const m = monthlyMap.get(d.medium);
    const exRow = ws.addRow([
      d.medium,
      d.cur.sessions, d.prev.sessions, '',
      d.cur.users, '',
      m?.cur.sessions ?? 0, m?.prev.sessions ?? 0, '',
      m?.cur.users ?? 0, '',
      m?.cur.newUsers ?? 0,
    ]);
    applyDataRow(exRow, headers.length, i % 2 === 0);
    [2, 3, 5, 7, 8, 10, 12].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
    applyPctCell(exRow.getCell(4), d.mom.sessions);
    applyPctCell(exRow.getCell(6), d.mom.users);
    if (m) {
      applyPctCell(exRow.getCell(9), m.mom.sessions);
      applyPctCell(exRow.getCell(11), m.mom.users);
    }
  });

  // 加入 monthly 裡有但 daily 沒有的 medium
  const dailyMediums = new Set(dailyRows.map((r) => r.medium));
  [...monthlyMap.values()].filter((m) => !dailyMediums.has(m.medium)).forEach((m, idx) => {
    const exRow = ws.addRow([
      m.medium,
      0, 0, '',
      0, '',
      m.cur.sessions, m.prev.sessions, '',
      m.cur.users, '',
      m.cur.newUsers,
    ]);
    applyDataRow(exRow, headers.length, (dailyRows.length + idx) % 2 === 0);
    [7, 8, 10, 12].forEach((c) => { exRow.getCell(c).numFmt = numFmt; });
    applyPctCell(exRow.getCell(9), m.mom.sessions);
    applyPctCell(exRow.getCell(11), m.mom.users);
  });
}

// ── Google 每日趨勢頁籤（含折線圖）────────────────────────────
async function buildGoogleDailyTrendSheet(wb: ExcelJS.Workbook, rows: GoogleDailyRow[]) {
  const ws = wb.addWorksheet('Google每日趨勢');

  ws.columns = [
    { header: '日期', key: 'date', width: 14 },
    { header: '工作階段', key: 'sessions', width: 14 },
    { header: '用戶數', key: 'users', width: 12 },
  ];

  applyHeader(ws.getRow(1), 3);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row, i) => {
    const exRow = ws.addRow({ date: row.date, sessions: row.sessions, users: row.users });
    applyDataRow(exRow, 3, i % 2 === 0);
    exRow.getCell(1).numFmt = '@';
    exRow.getCell(2).numFmt = '#,##0';
    exRow.getCell(3).numFmt = '#,##0';
  });

  // 產生折線圖（SVG → PNG 嵌入）
  try {
    const W = 1200, H = 480;
    const padL = 80, padR = 30, padT = 50, padB = 70;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const sessions = rows.map((r) => r.sessions);
    const users    = rows.map((r) => r.users);
    const maxVal   = Math.max(...sessions, ...users);
    const minVal   = Math.min(...sessions, ...users);
    const range    = maxVal - minVal || 1;

    const xStep = chartW / (rows.length - 1 || 1);
    const toX = (i: number) => padL + i * xStep;
    const toY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

    const polyline = (vals: number[], color: string, opacity: string) => {
      const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
      const area = `${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} ` + pts + ` ${toX(vals.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)}`;
      return `<polygon points="${area}" fill="${color}" opacity="${opacity}"/>
              <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
    };

    // X 軸刻度（每月 1 日）
    const xLabels = rows.reduce<string>((acc, r, i) => {
      if (r.date.endsWith('-01') || i === 0) {
        const x = toX(i).toFixed(1);
        const label = r.date.slice(0, 7);
        return acc + `<text x="${x}" y="${padT + chartH + 20}" text-anchor="middle" font-size="11" fill="#555">${label}</text>
                      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + chartH}" stroke="#e0e0e0" stroke-width="1"/>`;
      }
      return acc;
    }, '');

    // Y 軸刻度（5 條）
    const yLabels = Array.from({ length: 6 }, (_, i) => {
      const v = minVal + (range / 5) * i;
      const y = toY(v).toFixed(1);
      const label = Math.round(v).toLocaleString();
      return `<text x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="#555">${label}</text>
              <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font-family:Arial,sans-serif">
      <text x="${W / 2}" y="28" text-anchor="middle" font-size="16" font-weight="bold" fill="#1F3864">Google 每日流量趨勢（2026年）</text>
      ${yLabels}
      ${polyline(sessions, '#2E75B6', '0.12')}
      ${polyline(users,    '#70AD47', '0.12')}
      ${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="#aaa" stroke-width="1.5"/>
      <!-- 圖例 -->
      <rect x="${padL}" y="${H - 22}" width="14" height="4" fill="#2E75B6"/>
      <text x="${padL + 18}" y="${H - 16}" font-size="12" fill="#333">工作階段</text>
      <rect x="${padL + 90}" y="${H - 22}" width="14" height="4" fill="#70AD47"/>
      <text x="${padL + 108}" y="${H - 16}" font-size="12" fill="#333">用戶數</text>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const imageId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 4, row: 1 }, ext: { width: W, height: H } });
  } catch (e) {
    console.warn('⚠️  圖表產生失敗，跳過：', e);
  }
}

// ── 會員行為分析頁籤 ─────────────────────────────────────────
function buildBehaviorSheet(
  wb: ExcelJS.Workbook,
  overview: BehaviorOverviewRow,
  funnel: FunnelRow[],
  exitPages: ExitPageRow[],
  topPages: TopPageRow[],
  dates: ReturnType<typeof getDateRanges>
) {
  const ws = wb.addWorksheet('會員行為分析');
  ws.columns = [
    { width: 40 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 },
  ];

  const addSectionTitle = (title: string) => {
    ws.addRow([]);
    const r = ws.addRow([title]);
    r.getCell(1).font = { bold: true, size: 12, color: { argb: COLOR.headerFont } };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    r.getCell(1).alignment = { vertical: 'middle' };
    r.height = 22;
    ws.mergeCells(`A${r.number}:E${r.number}`);
  };

  // ── 1. 行為總覽 ──
  addSectionTitle(`▌ 行為總覽（${dates.thisMonthStart} ～ ${dates.thisMonthEnd}）`);
  const hdr1 = ws.addRow(['指標', '數值', '', '', '']);
  applyHeader(hdr1, 2);

  const overviewMetrics = [
    { label: '跳離率 Bounce Rate',           value: `${overview.bounceRate.toFixed(1)}%` },
    { label: '互動率 Engagement Rate',        value: `${overview.engagementRate.toFixed(1)}%` },
    { label: '平均工作階段時長',               value: `${Math.floor(overview.avgSessionDuration / 60)}分 ${Math.round(overview.avgSessionDuration % 60)}秒` },
    { label: '每工作階段頁面數 Pages/Session', value: overview.pagesPerSession.toFixed(2) },
  ];
  overviewMetrics.forEach((m, i) => {
    const r = ws.addRow([m.label, m.value]);
    applyDataRow(r, 2, i % 2 === 0);
  });

  // ── 2. 電商漏斗 ──
  addSectionTitle(`▌ 電商轉換漏斗（本月）`);
  const hdr2 = ws.addRow(['步驟', '次數', '步驟轉換率', '', '']);
  applyHeader(hdr2, 3);

  funnel.forEach((row, i) => {
    const prevCount = i > 0 ? funnel[i - 1].count : row.count;
    const convRate  = prevCount > 0 ? (row.count / prevCount) * 100 : 100;
    const exRow = ws.addRow([row.step, row.count, i === 0 ? '—' : `${convRate.toFixed(1)}%`]);
    applyDataRow(exRow, 3, i % 2 === 0);
    exRow.getCell(2).numFmt = '#,##0';
  });

  // ── 3. 高跳離頁面 ──
  addSectionTitle(`▌ 高跳離頁面 TOP 15（按跳離率排序，僅含瀏覽量≥10的頁面）`);
  const hdr3 = ws.addRow(['頁面路徑', '頁面瀏覽', '跳離率', '互動率', '']);
  applyHeader(hdr3, 4);

  exitPages.forEach((row, i) => {
    const exRow = ws.addRow([row.pagePath, row.pageViews, `${row.bounceRate.toFixed(1)}%`, `${row.engagementRate.toFixed(1)}%`]);
    applyDataRow(exRow, 4, i % 2 === 0);
    exRow.getCell(2).numFmt = '#,##0';
  });

  // ── 4. 高互動頁面 ──
  addSectionTitle(`▌ 瀏覽次數最高頁面 TOP 15`);
  const hdr4 = ws.addRow(['頁面路徑', '頁面瀏覽', '平均停留時間', '跳離率', '']);
  applyHeader(hdr4, 4);

  topPages.forEach((row, i) => {
    const durStr = `${Math.floor(row.avgDuration / 60)}分 ${Math.round(row.avgDuration % 60)}秒`;
    const exRow = ws.addRow([row.pagePath, row.pageViews, durStr, `${row.bounceRate.toFixed(1)}%`]);
    applyDataRow(exRow, 4, i % 2 === 0);
    exRow.getCell(2).numFmt = '#,##0';
  });
}

// ── AI 分析頁籤 ──────────────────────────────────────────────
function buildInsightSheet(wb: ExcelJS.Workbook, insight: string) {
  const ws = wb.addWorksheet('AI分析');
  ws.columns = [{ width: 120 }];

  const titleRow = ws.addRow(['AI 洞察分析']);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: COLOR.headerFont } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  titleRow.height = 26;

  ws.addRow([]);

  insight.split('\n').forEach((line) => {
    const r = ws.addRow([line]);
    r.getCell(1).font = { size: 10 };
    r.getCell(1).alignment = { wrapText: true };
  });
}

// ── 主程式 ───────────────────────────────────────────────────
async function main() {
  const dates = getDateRanges();
  const last7Start = (() => {
    const d = new Date(dates.yesterday);
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  })();
  console.log(`\n📊 GA4 每日分析報告`);
  console.log(`分析日期：${dates.yesterday}`);
  console.log('正在抓取資料...\n');

  const [
    yesterday, lastMonthSameDay, thisMonth, lastMonthSamePeriod, dailyTotals,
    googleYesterday, googleLastMonthSameDay, googleThisMonth, googleLastMonthSamePeriod,
    googleDailyTrend,
    googleDailyByMedium,
    organicLandingCur, organicLandingPrev,
    organicDeviceCur, organicDevicePrev,
    organicNvrCur, organicNvrPrev,
    platformDailyTrend,
    platformDailyCur, platformDailyPrev,
    platformMonthCur, platformMonthPrev,
    ecommerceDaily,
    ecommerceDailyCur, ecommerceDailyPrev,
    ecommerceMonthCur, ecommerceMonthPrev,
    behaviorOverview,
    funnelData,
    exitPages,
    topPages,
    mauCur,
    mauPrev,
    todayHourly,
    yesterdayHourly,
    channelMonthCur,
    channelMonthPrev,
    channelToday,
    channelMonthlyTrend,
    catHaoKangCur, catHaoKangPrev, catHaoKangFullPrev, catHaoKangPrevPrev,
    catShengHuoCur, catShengHuoPrev, catShengHuoFullPrev, catShengHuoPrevPrev,
    catMianYunCur, catMianYunPrev, catMianYunFullPrev, catMianYunPrevPrev,
    googleEcomCur,
    googleEcomPrev,
    promoYesterday,
    promoLast7,
    promoThisMonth,
    promoLastMonth,
    aiCur,  aiPrev,  aiYear,  aiAll,
    aiLandingCur, aiLandingPrev, aiLandingYear, aiLandingAll,
    searchToday, searchTodayPrev,
    searchWeek,  searchWeekPrev,
  ] = await Promise.all([
    fetchYesterdayReport(),
    fetchLastMonthSameDayReport(),
    fetchThisMonthReport(),
    fetchLastMonthSamePeriodReport(),
    fetchDailyTotalsSince('2026-01-01'),
    fetchGoogleChannelYesterday(),
    fetchGoogleChannelLastMonthSameDay(),
    fetchGoogleChannelThisMonth(),
    fetchGoogleChannelLastMonthSamePeriod(),
    fetchGoogleDailySince('2026-01-01'),
    fetchGoogleDailyByMediumSince('2026-01-01'),
    fetchOrganicLandingPages(dates.thisMonthStart, dates.thisMonthEnd),
    fetchOrganicLandingPages(dates.lastMonthStart, dates.lastMonthEnd),
    fetchOrganicByDevice(dates.thisMonthStart, dates.thisMonthEnd),
    fetchOrganicByDevice(dates.lastMonthStart, dates.lastMonthEnd),
    fetchOrganicNewVsReturn(dates.thisMonthStart, dates.thisMonthEnd),
    fetchOrganicNewVsReturn(dates.lastMonthStart, dates.lastMonthEnd),
    fetchPlatformDailySince('2026-01-01'),
    fetchPlatformReport(dates.yesterday, dates.yesterday),
    fetchPlatformReport(dates.lastMonthSameDay, dates.lastMonthSameDay),
    fetchPlatformReport(dates.thisMonthStart, dates.thisMonthEnd),
    fetchPlatformReport(dates.lastMonthStart, dates.lastMonthEnd),
    fetchEcommerceDailySince('2026-01-01'),
    fetchEcommerceReport(dates.yesterday, dates.yesterday),
    fetchEcommerceReport(dates.lastMonthSameDay, dates.lastMonthSameDay),
    fetchEcommerceReport(dates.thisMonthStart, dates.thisMonthEnd),
    fetchEcommerceReport(dates.lastMonthStart, dates.lastMonthEnd),
    fetchBehaviorOverview(dates.thisMonthStart, dates.thisMonthEnd),
    fetchFunnelData(dates.thisMonthStart, dates.thisMonthEnd),
    fetchTopExitPages(dates.thisMonthStart, dates.thisMonthEnd),
    fetchTopPagesByEngagement(dates.thisMonthStart, dates.thisMonthEnd),
    fetchMonthlyUsers(dates.thisMonthStart, dates.thisMonthEnd),
    fetchMonthlyUsers(dates.lastMonthStart, dates.lastMonthEnd),
    fetchHourlyTraffic('today'),
    fetchHourlyTraffic(dates.yesterday),
    fetchChannelUsers(dates.thisMonthStart, dates.thisMonthEnd),
    fetchChannelUsers(dates.lastMonthStart, dates.lastMonthEnd),
    fetchChannelUsers('today', 'today'),
    fetchChannelMonthlyTrend('2026-01-01', dates.yesterday),
    fetchChannelByItemCategory('好康館', dates.thisMonthStart,    dates.thisMonthEnd),
    fetchChannelByItemCategory('好康館', dates.lastMonthStart,    dates.lastMonthEnd),
    fetchChannelByItemCategory('好康館', dates.lastMonthFullStart, dates.lastMonthFullEnd),
    fetchChannelByItemCategory('好康館', dates.twoMonthsAgoStart,  dates.twoMonthsAgoEnd),
    fetchChannelByItemCategory('生活館', dates.thisMonthStart,    dates.thisMonthEnd),
    fetchChannelByItemCategory('生活館', dates.lastMonthStart,    dates.lastMonthEnd),
    fetchChannelByItemCategory('生活館', dates.lastMonthFullStart, dates.lastMonthFullEnd),
    fetchChannelByItemCategory('生活館', dates.twoMonthsAgoStart,  dates.twoMonthsAgoEnd),
    fetchChannelByItemCategory('免運館', dates.thisMonthStart,    dates.thisMonthEnd),
    fetchChannelByItemCategory('免運館', dates.lastMonthStart,    dates.lastMonthEnd),
    fetchChannelByItemCategory('免運館', dates.lastMonthFullStart, dates.lastMonthFullEnd),
    fetchChannelByItemCategory('免運館', dates.twoMonthsAgoStart,  dates.twoMonthsAgoEnd),
    fetchGoogleEcommerce(dates.thisMonthStart, dates.thisMonthEnd),
    fetchGoogleEcommerce(dates.lastMonthStart, dates.lastMonthEnd),
    fetchPromotionClicks(dates.yesterday, dates.yesterday),
    fetchPromotionClicks(last7Start, dates.yesterday),
    fetchPromotionClicks(dates.thisMonthStart, dates.thisMonthEnd),
    fetchPromotionClicks(dates.lastMonthStart, dates.lastMonthEnd),
    fetchAiTraffic(dates.thisMonthStart,     dates.yesterday),
    fetchAiTraffic(dates.lastMonthFullStart, dates.lastMonthFullEnd),
    fetchAiTraffic('2026-01-01',             dates.yesterday),
    fetchAiTraffic('2025-01-01',             dates.yesterday),
    fetchAiLandingPages(dates.thisMonthStart,     dates.yesterday),
    fetchAiLandingPages(dates.lastMonthFullStart, dates.lastMonthFullEnd),
    fetchAiLandingPages('2026-01-01',             dates.yesterday),
    fetchAiLandingPages('2025-01-01',             dates.yesterday),
    // 站內搜尋：當天 vs 前一天，前7天 vs 再前7天
    fetchSiteSearch(dates.yesterday, dates.yesterday),
    fetchSiteSearch(dates.dayBeforeYesterday, dates.dayBeforeYesterday),
    fetchSiteSearch(last7Start, dates.yesterday),
    fetchSiteSearch(dates.prev7Start, dates.prev7End),
  ]);

  const dailyComparison = compareMom(yesterday, lastMonthSameDay);
  const monthlyComparison = compareMom(thisMonth, lastMonthSamePeriod);

  const dailyTable = formatMomTable(dailyComparison, `每日比較：${dates.yesterday} vs ${dates.lastMonthSameDay}`);
  const monthlyTable = formatMomTable(monthlyComparison, `月累計比較：${dates.thisMonthStart}～${dates.thisMonthEnd} vs ${dates.lastMonthStart}～${dates.lastMonthEnd}`);

  console.log(dailyTable);
  console.log('\n');
  console.log(monthlyTable);

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GA4-Analytics';
  wb.created = new Date();

  buildTotalSheet(wb, dailyTotals);
  await buildGoogleDailyTrendSheet(wb, googleDailyTrend);
  await buildGoogleMediumTrendSheet(wb, googleDailyByMedium);
  buildMomSheet(wb, '每日比較', dailyComparison);
  buildMomSheet(wb, '月累計比較', monthlyComparison);
  await buildEcommerceDailySheet(wb, ecommerceDaily, ecommerceDailyCur, ecommerceDailyPrev, ecommerceMonthCur, ecommerceMonthPrev, dates);
  await buildPlatformDailyTrendSheet(wb, platformDailyTrend);
  buildPlatformMomSheet(wb, platformDailyCur, platformDailyPrev, platformMonthCur, platformMonthPrev, dates);
  buildOrganicAnalysisSheet(wb,
    organicLandingCur, organicLandingPrev,
    organicDeviceCur, organicDevicePrev,
    organicNvrCur, organicNvrPrev,
    dates
  );
  buildGoogleSheet(wb, 'Google渠道分析',
    { cur: googleYesterday, prev: googleLastMonthSameDay },
    { cur: googleThisMonth, prev: googleLastMonthSamePeriod },
    dates
  );
  buildBehaviorSheet(wb, behaviorOverview, funnelData, exitPages, topPages, dates);

  // archive 資料夾（歷史備份）
  const archiveDir = path.join(reportsDir, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

  // ── 今日概況：最優先儲存（不依賴 AI，快速完成）──
  const todayDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const todayDateStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
  const todayHtml = generateTodayHtml(todayDateStr, dates.yesterday, todayHourly, yesterdayHourly, channelToday);
  fs.writeFileSync(path.join(reportsDir, 'report-today.html'), todayHtml, 'utf-8');
  console.log(`✅ 今日概況已儲存：reports/report-today.html`);

  const channelTrendHtml = generateChannelTrendHtml(channelMonthlyTrend);
  fs.writeFileSync(path.join(reportsDir, 'report-channels.html'), channelTrendHtml, 'utf-8');
  console.log(`✅ 渠道月趨勢已儲存：reports/report-channels.html`);

  const categoryTabs: CategoryTabData[] = [
    { name: '好康館', cur: catHaoKangCur,  prev: catHaoKangPrev,  prevFull: catHaoKangFullPrev,  prevPrevFull: catHaoKangPrevPrev  },
    { name: '生活館', cur: catShengHuoCur, prev: catShengHuoPrev, prevFull: catShengHuoFullPrev, prevPrevFull: catShengHuoPrevPrev },
    { name: '免運館', cur: catMianYunCur,  prev: catMianYunPrev,  prevFull: catMianYunFullPrev,  prevPrevFull: catMianYunPrevPrev  },
  ];
  const categoryHtml = generateCategoryHtml(categoryTabs, dates);
  fs.writeFileSync(path.join(reportsDir, 'report-category.html'), categoryHtml, 'utf-8');
  console.log(`✅ 商品分類分析已儲存：reports/report-category.html`);

  // ── 版位促銷點擊 ─────────────────────────────────────────────
  const promotionHtml = generatePromotionHtml(
    [
      { label: `昨日（${dates.yesterday}）`,                       rows: promoYesterday },
      { label: `近7天（${last7Start} ～ ${dates.yesterday}）`,     rows: promoLast7    },
      { label: `本月（${dates.thisMonthStart} ～ ${dates.thisMonthEnd}）`, rows: promoThisMonth },
      { label: `上月（${dates.lastMonthStart} ～ ${dates.lastMonthEnd}）`, rows: promoLastMonth },
    ],
    dates.yesterday,
  );
  fs.writeFileSync(path.join(reportsDir, 'report-promotion.html'), promotionHtml, 'utf-8');
  console.log(`✅ 版位促銷點擊已儲存：reports/report-promotion.html`);

  const aiHtml = generateAiHtml([
    { key: 'cur',  label: `本月（${dates.thisMonthStart} ～ ${dates.yesterday}）`,                rows: aiCur,  landingRows: aiLandingCur,  startDate: dates.thisMonthStart,     endDate: dates.yesterday },
    { key: 'prev', label: `上月（${dates.lastMonthFullStart} ～ ${dates.lastMonthFullEnd}）`,     rows: aiPrev, landingRows: aiLandingPrev, startDate: dates.lastMonthFullStart, endDate: dates.lastMonthFullEnd },
    { key: 'year', label: `今年（2026-01-01 ～ ${dates.yesterday}）`,                            rows: aiYear, landingRows: aiLandingYear, startDate: '2026-01-01',             endDate: dates.yesterday },
    { key: 'all',  label: `全部（2025-01-01 ～ ${dates.yesterday}）`,                            rows: aiAll,  landingRows: aiLandingAll,  startDate: '2025-01-01',             endDate: dates.yesterday },
    { key: 'revenue', label: '💰 有產生營收',                                                   rows: aiAll,  landingRows: aiLandingAll,  startDate: '2025-01-01',             endDate: dates.yesterday, revenueOnly: true },
  ]);
  fs.writeFileSync(path.join(reportsDir, 'report-ai.html'), aiHtml, 'utf-8');
  console.log(`✅ AI 流量分析已儲存：reports/report-ai.html`);

  const searchHtml = generateSearchHtml([
    {
      key:      'today',
      label:    `當天（${dates.yesterday}）`,
      rows:     searchToday,
      prevRows: searchTodayPrev,
    },
    {
      key:      'week',
      label:    `前7天（${last7Start} ～ ${dates.yesterday}）`,
      rows:     searchWeek,
      prevRows: searchWeekPrev,
    },
  ], new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
  fs.writeFileSync(path.join(reportsDir, 'report-search.html'), searchHtml, 'utf-8');
  console.log(`✅ 搜尋字詞排行已儲存：reports/report-search.html`);

  // ── HTML（先存無 AI 版，確保報告一定更新）──
  const htmlContent = generateHtml(
    dates.yesterday, dates,
    dailyTotals,
    platformDailyTrend,
    platformDailyCur, platformDailyPrev,
    googleDailyByMedium,
    dailyComparison, monthlyComparison,
    '',          // insight 先留空
    ecommerceDaily,
    ecommerceDailyCur, ecommerceDailyPrev,
    ecommerceMonthCur, ecommerceMonthPrev,
    behaviorOverview,
    funnelData,
    exitPages,
    topPages,
    mauCur,
    mauPrev,
    channelMonthCur,
    channelMonthPrev,
    googleEcomCur,
    googleEcomPrev,
  );
  fs.writeFileSync(path.join(reportsDir, 'report-latest.html'), htmlContent, 'utf-8');
  fs.writeFileSync(path.join(archiveDir, `report-${dates.yesterday}.html`), htmlContent, 'utf-8');
  console.log(`✅ HTML 已儲存：reports/report-latest.html  （備份：archive/report-${dates.yesterday}.html）`);

  // ── AI 分析（耗時步驟，失敗不影響報告更新）──
  let insight = '';
  try {
    console.log('\n🤖 正在產生 AI 洞察分析...\n');
    insight = await generateInsight(dates.yesterday, dailyComparison, monthlyComparison);
    console.log(insight);

    // AI 完成後，用含 AI 版本覆蓋 HTML
    const htmlWithInsight = generateHtml(
      dates.yesterday, dates,
      dailyTotals,
      platformDailyTrend,
      platformDailyCur, platformDailyPrev,
      googleDailyByMedium,
      dailyComparison, monthlyComparison,
      insight,
      ecommerceDaily,
      ecommerceDailyCur, ecommerceDailyPrev,
      ecommerceMonthCur, ecommerceMonthPrev,
      behaviorOverview,
      funnelData,
      exitPages,
      topPages,
      mauCur,
      mauPrev,
      channelMonthCur,
      channelMonthPrev,
      googleEcomCur,
      googleEcomPrev,
    );
    fs.writeFileSync(path.join(reportsDir, 'report-latest.html'), htmlWithInsight, 'utf-8');
    fs.writeFileSync(path.join(archiveDir, `report-${dates.yesterday}.html`), htmlWithInsight, 'utf-8');
    buildInsightSheet(wb, insight);
    console.log('✅ AI 洞察已寫入 HTML & Excel');
  } catch (err: any) {
    console.warn('\n⚠️  AI 分析失敗，跳過：', err.message ?? err);
  }

  // ── Excel：固定 latest + 備份 ──
  let xlsxSaved = 'report-latest.xlsx';
  try {
    await wb.xlsx.writeFile(path.join(reportsDir, 'report-latest.xlsx'));
  } catch (e: any) {
    if (e.code !== 'EBUSY') throw e;
    console.warn('⚠️  report-latest.xlsx 正在開啟中，跳過覆蓋');
    xlsxSaved = '（已開啟，略過）';
  }
  await wb.xlsx.writeFile(path.join(archiveDir, `report-${dates.yesterday}.xlsx`));
  console.log(`✅ Excel 已儲存：reports/${xlsxSaved}  （備份：archive/report-${dates.yesterday}.xlsx）`);
}

main().catch((err) => {
  console.error('執行失敗：', err);
  process.exit(1);
});
