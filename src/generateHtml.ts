import { MomRow } from './momCompare.js';
import { DailyTotalRow, PlatformRow, PlatformDailyRow, GoogleDailyByMediumRow, EcommerceDailyRow, EcommerceRow, BehaviorOverviewRow, FunnelRow, ExitPageRow, TopPageRow, MonthlyUsersRow, ChannelRow, GoogleEcomRow, PromotionClickRow } from './fetchReport.js';

function momBadge(v: number): string {
  if (v === 0) return `<span class="badge neutral">—</span>`;
  const sign = v > 0 ? '+' : '';
  const cls  = v > 0 ? 'up' : 'down';
  return `<span class="badge ${cls}">${sign}${(v).toFixed(1)}%</span>`;
}

function momCell(v: number): string {
  if (v === 0) return `<td class="num">—</td>`;
  const sign = v > 0 ? '+' : '';
  const cls  = v > 0 ? 'cell-up' : 'cell-dn';
  return `<td class="num ${cls}">${sign}${v.toFixed(1)}%</td>`;
}

function num(v: number): string {
  return v.toLocaleString();
}

export function generateHtml(
  dateLabel: string,
  dates: { yesterday: string; lastMonthSameDay: string; thisMonthStart: string; thisMonthEnd: string; lastMonthStart: string; lastMonthEnd: string },
  dailyTotals: DailyTotalRow[],
  platformDailyTrend: PlatformDailyRow[],
  platformDailyCur: PlatformRow[],
  platformDailyPrev: PlatformRow[],
  googleDailyByMedium: GoogleDailyByMediumRow[],
  dailyComparison: MomRow[],
  monthlyComparison: MomRow[],
  insight: string,
  ecommerceDaily: EcommerceDailyRow[],
  ecommerceDailyCur: EcommerceRow,
  ecommerceDailyPrev: EcommerceRow,
  ecommerceMonthCur: EcommerceRow,
  ecommerceMonthPrev: EcommerceRow,
  behaviorOverview: BehaviorOverviewRow,
  funnelData: FunnelRow[],
  exitPages: ExitPageRow[],
  topPages: TopPageRow[],
  mauCur: MonthlyUsersRow,
  mauPrev: MonthlyUsersRow,
  channelMonthCur: ChannelRow[],
  channelMonthPrev: ChannelRow[],
  googleEcomCur: GoogleEcomRow[],
  googleEcomPrev: GoogleEcomRow[],
): string {
  // ── 數字卡片資料 ────────────────────────────────────────────
  const totalYesterday = dailyTotals[dailyTotals.length - 1]?.users ?? 0;
  const totalPrevDay   = dailyTotals[dailyTotals.length - 2]?.users ?? 0;
  const totalDod       = totalPrevDay > 0 ? ((totalYesterday - totalPrevDay) / totalPrevDay) * 100 : 0;

  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
  const prevMap = new Map(platformDailyPrev.map((r) => [r.platform, r]));

  const cards = (['Web', 'mWeb', 'App'] as const).map((platform) => {
    const cur  = platformDailyCur.find((r) => r.platform === platform);
    const prev = prevMap.get(platform);
    const sessions = cur?.sessions ?? 0;
    const momPct   = mom(sessions, prev?.sessions ?? 0);
    return { platform, sessions, momPct };
  });

  // ── 行為分析 HTML 準備 ───────────────────────────────────────
  const funnelMax = funnelData[0]?.count ?? 1;
  const funnelRows = funnelData.map((row, i) => {
    const barPct  = funnelMax > 0 ? (row.count / funnelMax) * 100 : 0;
    const convPct = i > 0 && funnelData[i - 1].count > 0
      ? ((row.count / funnelData[i - 1].count) * 100).toFixed(1)
      : null;
    return `
    <tr>
      <td class="src" style="width:130px;font-weight:600;">${row.step}</td>
      <td style="width:60%;padding:6px 12px;">
        <div style="background:#eef2f8;border-radius:4px;overflow:hidden;height:22px;position:relative;">
          <div style="background:#2E75B6;width:${barPct.toFixed(1)}%;height:100%;border-radius:4px;"></div>
          <span style="position:absolute;left:10px;top:2px;font-size:12px;font-weight:600;color:#1F3864;">${row.count.toLocaleString()}</span>
        </div>
      </td>
      <td class="num" style="width:100px;">${convPct !== null ? `<span class="badge ${parseFloat(convPct) >= 50 ? 'up' : 'down'}">${convPct}%</span>` : '<span class="badge neutral">基準</span>'}</td>
    </tr>`;
  }).join('');

  const exitPageRows = exitPages.map((r, i) => `
    <tr>
      <td class="src">${r.pagePath}</td>
      <td class="num">${r.pageViews.toLocaleString()}</td>
      <td class="num ${r.bounceRate > 60 ? 'cell-dn' : r.bounceRate > 30 ? '' : 'cell-up'}">${r.bounceRate.toFixed(1)}%</td>
      <td class="num ${r.engagementRate > 60 ? 'cell-up' : r.engagementRate > 30 ? '' : 'cell-dn'}">${r.engagementRate.toFixed(1)}%</td>
    </tr>`).join('');

  const topPageRows = topPages.map((r, i) => {
    const durStr = `${Math.floor(r.avgDuration / 60)}m ${Math.round(r.avgDuration % 60)}s`;
    return `
    <tr>
      <td class="src">${r.pagePath}</td>
      <td class="num">${r.pageViews.toLocaleString()}</td>
      <td class="num">${durStr}</td>
      <td class="num ${r.bounceRate > 60 ? 'cell-dn' : r.bounceRate > 30 ? '' : 'cell-up'}">${r.bounceRate.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  // ── 電商 JSON ────────────────────────────────────────────────
  const ecomLabels    = JSON.stringify(ecommerceDaily.map((r) => r.date));
  const ecomSessions  = JSON.stringify(ecommerceDaily.map((r) => r.sessions));
  const ecomSessionsDod = JSON.stringify(ecommerceDaily.map((r, i) => {
    const prev = ecommerceDaily[i - 1]?.sessions ?? 0;
    return prev > 0 ? parseFloat(((r.sessions - prev) / prev * 100).toFixed(1)) : null;
  }));
  const ecomRevenue   = JSON.stringify(ecommerceDaily.map((r) => Math.round(r.revenue)));
  const ecomTxn       = JSON.stringify(ecommerceDaily.map((r) => r.transactions));
  const ecomCvr       = JSON.stringify(ecommerceDaily.map((r) => parseFloat(r.cvr.toFixed(2))));
  const ecomAov       = JSON.stringify(ecommerceDaily.map((r) => Math.round(r.aov)));
  const ecomCart      = JSON.stringify(ecommerceDaily.map((r) => r.addToCarts));

  const momPctEcom = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

  // ── 每日總流量 JSON ──────────────────────────────────────────
  const totalLabels = JSON.stringify(dailyTotals.map((r) => r.date));
  const totalUsers  = JSON.stringify(dailyTotals.map((r) => r.users));
  const totalDodArr = JSON.stringify(dailyTotals.map((r, i) => {
    const prev = dailyTotals[i - 1]?.users ?? 0;
    return prev > 0 ? parseFloat(((r.users - prev) / prev * 100).toFixed(1)) : null;
  }));

  // ── 平台每日趨勢 JSON ────────────────────────────────────────
  const platLabels  = JSON.stringify(platformDailyTrend.map((r) => r.date));
  const platWeb     = JSON.stringify(platformDailyTrend.map((r) => r.web));
  const platMweb    = JSON.stringify(platformDailyTrend.map((r) => r.mweb));
  const platApp     = JSON.stringify(platformDailyTrend.map((r) => r.app));

  // ── Google 各媒介每日趨勢 JSON ───────────────────────────────
  const allDates   = [...new Set(googleDailyByMedium.map((r) => r.date))].sort();
  const mediumTotals = new Map<string, number>();
  googleDailyByMedium.forEach((r) => mediumTotals.set(r.medium, (mediumTotals.get(r.medium) ?? 0) + r.sessions));
  const topMediums = [...mediumTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);
  const lookup = new Map<string, Map<string, number>>();
  googleDailyByMedium.forEach((r) => {
    if (!lookup.has(r.date)) lookup.set(r.date, new Map());
    lookup.get(r.date)!.set(r.medium, r.sessions);
  });
  const GCOLORS = ['#2E75B6', '#ED7D31', '#70AD47', '#FFC000', '#A550A7'];
  const googleDatasets = JSON.stringify(topMediums.map((medium, i) => ({
    label: medium,
    data: allDates.map((d) => lookup.get(d)?.get(medium) ?? 0),
    borderColor: GCOLORS[i],
    backgroundColor: GCOLORS[i] + '18',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
    fill: false,
  })));
  const googleLabels = JSON.stringify(allDates);

  // ── 渠道表格 HTML ────────────────────────────────────────────
  const momTableRows = (rows: MomRow[]) => rows.slice(0, 15).map((r) => `
    <tr>
      <td class="src">${r.sessionSource}</td>
      <td class="num">${num(r.current.sessions)}</td>
      <td class="num">${num(r.previous.sessions)}</td>
      ${momCell(r.mom.sessions)}
      <td class="num">${num(r.current.users)}</td>
      ${momCell(r.mom.users)}
    </tr>`).join('');

  // ── 渠道用戶分布 HTML 準備 ───────────────────────────────────
  const CH_COLORS = ['#2E75B6','#ED7D31','#70AD47','#FFC000','#A550A7','#00B0F0','#FF6B6B','#4BACC6','#7030A0','#A9A9A9'];
  const chTotal = channelMonthCur.reduce((s, r) => s + r.users, 0);
  const chPrevMap = new Map(channelMonthPrev.map((r) => [r.channel, r]));
  const channelTableRows = channelMonthCur.map((r, i) => {
    const pct     = chTotal > 0 ? (r.users / chTotal * 100).toFixed(1) : '0.0';
    const prev    = chPrevMap.get(r.channel);
    const momPct  = prev && prev.users > 0 ? ((r.users - prev.users) / prev.users * 100) : null;
    const momStr  = momPct !== null
      ? `<span class="badge ${momPct >= 0 ? 'up' : 'down'}">${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%</span>`
      : `<span class="badge neutral">新</span>`;
    const dot = `<span style="display:inline-block;width:10px;height:10px;background:${CH_COLORS[i % CH_COLORS.length]};border-radius:50%;margin-right:6px;"></span>`;
    return `
    <tr>
      <td class="src">${dot}${r.channel}</td>
      <td class="num">${r.users.toLocaleString()}</td>
      <td class="num">${pct}%</td>
      <td class="num">${r.sessions.toLocaleString()}</td>
      <td class="num">${r.newUsers.toLocaleString()}</td>
      <td class="num">${momStr}</td>
    </tr>`;
  }).join('');
  const chLabels = JSON.stringify(channelMonthCur.map((r) => r.channel));
  const chData   = JSON.stringify(channelMonthCur.map((r) => r.users));
  const chColors = JSON.stringify(channelMonthCur.map((_, i) => CH_COLORS[i % CH_COLORS.length]));

  // ── Google CVR 表格 ──────────────────────────────────────────
  const geoPrevMap = new Map(googleEcomPrev.map((r) => [r.medium, r]));
  const googleCvrRows = googleEcomCur.map((r) => {
    const prev = geoPrevMap.get(r.medium);
    const cvrMom = prev && prev.cvr > 0 ? ((r.cvr - prev.cvr) / prev.cvr) * 100 : null;
    const momCell = cvrMom !== null
      ? `<span class="badge ${cvrMom >= 0 ? 'up' : 'down'}">${cvrMom >= 0 ? '+' : ''}${cvrMom.toFixed(1)}%</span>`
      : '<span class="badge neutral">—</span>';
    const cvrColor = r.cvr >= 3 ? '#276221' : r.cvr >= 1 ? '#ED7D31' : '#9c0006';
    return `
    <tr>
      <td class="src" style="font-weight:600;">${r.medium}</td>
      <td class="num">${r.sessions.toLocaleString()}</td>
      <td class="num">${r.addToCarts.toLocaleString()}</td>
      <td class="num">${r.purchases.toLocaleString()}</td>
      <td class="num">NT$ ${Math.round(r.revenue).toLocaleString()}</td>
      <td class="num" style="color:${cvrColor};font-weight:700;">${r.cvr.toFixed(2)}%</td>
      <td class="num">NT$ ${Math.round(r.aov).toLocaleString()}</td>
      <td class="num">${momCell}</td>
    </tr>`;
  }).join('');

  // ── Google CVR 橫條圖 ──
  const googleCvrLabels  = JSON.stringify(googleEcomCur.map((r) => r.medium));
  const googleCvrData    = JSON.stringify(googleEcomCur.map((r) => parseFloat(r.cvr.toFixed(2))));
  const googleCvrColors  = JSON.stringify(googleEcomCur.map((r) =>
    r.cvr >= 3 ? 'rgba(39,98,33,0.75)' : r.cvr >= 1 ? 'rgba(237,125,49,0.75)' : 'rgba(156,0,6,0.75)'
  ));

  // ── AI 分析格式化 ────────────────────────────────────────────
  const insightHtml = insight
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^###\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^##\s(.+)$/gm,  '<h3>$1</h3>')
    .replace(/^-\s(.+)$/gm,   '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');

  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GA4 流量報告 ${dateLabel}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }

  /* ── Header ── */
  .header { background: linear-gradient(135deg, #1F3864 0%, #2E75B6 100%); color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .header .meta { font-size: 12px; opacity: 0.75; text-align: right; line-height: 1.8; }

  /* ── Layout ── */
  .container { max-width: 1280px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 24px; }

  /* ── Cards ── */
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .cards-5 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 20px 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .label { font-size: 12px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 28px; font-weight: 700; color: #1F3864; }
  .card .sub   { font-size: 12px; color: #aaa; margin-top: 4px; }
  .card.total .value { color: #1F3864; }

  /* ── Badge ── */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge.up      { background: #e9f7ef; color: #276221; }
  .badge.down    { background: #ffecec; color: #9c0006; }
  .badge.neutral { background: #f0f0f0; color: #888; }

  /* ── Section ── */
  .section { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #1F3864; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #2E75B6; border-radius: 2px; }

  /* ── Chart ── */
  .chart-wrap { position: relative; height: 320px; }

  /* ── Grid 2 col ── */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

  /* ── Table ── */
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1F3864; color: #fff; padding: 9px 12px; text-align: center; font-weight: 600; white-space: nowrap; }
  th:first-child { text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  td.src { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; }
  td.num { text-align: right; color: #444; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #f8f9fc; }
  tr:hover td { background: #eef2fb; }
  .cell-up { color: #276221; font-weight: 600; background: #e9f7ef !important; }
  .cell-dn { color: #9c0006; font-weight: 600; background: #ffecec !important; }

  /* ── AI ── */
  .ai-body { line-height: 1.9; color: #333; }
  .ai-body h3 { font-size: 15px; color: #1F3864; margin: 20px 0 8px; border-left: 3px solid #2E75B6; padding-left: 10px; }
  .ai-body h4 { font-size: 14px; color: #2E75B6; margin: 14px 0 6px; }
  .ai-body p  { margin-bottom: 10px; }
  .ai-body li { margin-left: 20px; margin-bottom: 4px; }
  .ai-body strong { color: #1F3864; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab-btn { padding: 6px 16px; border: 1.5px solid #d0d8e8; border-radius: 20px; background: #fff; color: #555; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; }
  .tab-btn.active { background: #1F3864; color: #fff; border-color: #1F3864; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }

  @media (max-width: 1200px) {
    .cards-5 { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 768px) {
    .cards, .cards-5 { grid-template-columns: repeat(2, 1fr); }
    .grid2 { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>📊 GA4 每日流量報告</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">分析日期：${dateLabel}</div>
  </div>
  <div class="meta" style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
    <div style="display:flex;gap:8px;">
      <a href="report-today.html"    style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">⚡ 今日概況</a>
      <a href="report-channels.html" style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">📈 渠道月趨勢</a>
      <a href="report-category.html"  style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">🛍️ 分類分析</a>
      <a href="report-promotion.html" style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">📍 版位點擊</a>
      <a href="report-ai.html"        style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">🤖 AI 流量</a>
      <a href="report-search.html"   style="background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,0.5);">🔍 搜尋字詞</a>
    </div>
    <div style="font-size:12px;opacity:0.75;">產生時間：${generatedAt}<br>資料來源：Google Analytics 4</div>
  </div>
</div>

<div class="container">

  <!-- ── 數字卡片 ── -->
  <div class="cards-5">
    <div class="card total">
      <div class="label">昨日總用戶</div>
      <div class="value">${num(totalYesterday)}</div>
      <div class="sub">DoD ${momBadge(totalDod)} vs 前一天</div>
    </div>
    ${cards.map((c) => `
    <div class="card">
      <div class="label">${c.platform}</div>
      <div class="value">${num(c.sessions)}</div>
      <div class="sub">工作階段 MOM ${momBadge(c.momPct)}</div>
    </div>`).join('')}
    <div class="card">
      <div class="label">本月 MAU</div>
      <div class="value">${num(mauCur.users)}</div>
      <div class="sub">MOM ${momBadge(mom(mauCur.users, mauPrev.users))} 新用戶 ${num(mauCur.newUsers)}</div>
    </div>
    <div class="card">
      <div class="label">跳離率（本月）</div>
      <div class="value" style="color:${behaviorOverview.bounceRate > 60 ? '#9c0006' : behaviorOverview.bounceRate > 40 ? '#ED7D31' : '#276221'};">${behaviorOverview.bounceRate.toFixed(1)}%</div>
      <div class="sub">互動率 ${behaviorOverview.engagementRate.toFixed(1)}%</div>
    </div>
  </div>

  <!-- ── 電商指標卡片 ── -->
  <div class="section">
    <div class="section-title">電子商務總覽（昨日 vs 上月同天）</div>
    <div class="cards" style="grid-template-columns:repeat(4,1fr);">
      <div class="card">
        <div class="label">全站工作階段</div>
        <div class="value">${num(ecommerceDailyCur.sessions)}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.sessions, ecommerceDailyPrev.sessions))}</div>
      </div>
      <div class="card">
        <div class="label">交易次數</div>
        <div class="value">${num(ecommerceDailyCur.transactions)}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.transactions, ecommerceDailyPrev.transactions))}</div>
      </div>
      <div class="card">
        <div class="label">總收益</div>
        <div class="value" style="font-size:22px;">NT$ ${num(Math.round(ecommerceDailyCur.revenue))}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.revenue, ecommerceDailyPrev.revenue))}</div>
      </div>
      <div class="card">
        <div class="label">電商轉換率 CVR</div>
        <div class="value">${ecommerceDailyCur.cvr.toFixed(2)}%</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.cvr, ecommerceDailyPrev.cvr))}</div>
      </div>
      <div class="card">
        <div class="label">平均訂單金額 AOV</div>
        <div class="value" style="font-size:22px;">NT$ ${num(Math.round(ecommerceDailyCur.aov))}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.aov, ecommerceDailyPrev.aov))}</div>
      </div>
      <div class="card">
        <div class="label">加入購物車</div>
        <div class="value">${num(ecommerceDailyCur.addToCarts)}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceDailyCur.addToCarts, ecommerceDailyPrev.addToCarts))}</div>
      </div>
      <div class="card">
        <div class="label">本月累計收益</div>
        <div class="value" style="font-size:22px;">NT$ ${num(Math.round(ecommerceMonthCur.revenue))}</div>
        <div class="sub">MOM ${momBadge(momPctEcom(ecommerceMonthCur.revenue, ecommerceMonthPrev.revenue))}</div>
      </div>
    </div>
  </div>

  <!-- ── 電商趨勢圖 ── -->
  <div class="section">
    <div class="section-title">電商每日趨勢（2026年）</div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'ecomSessions')">工作階段</button>
      <button class="tab-btn" onclick="switchTab(this,'ecomRevTxn')">收益 &amp; 交易次數</button>
      <button class="tab-btn" onclick="switchTab(this,'ecomCvrAov')">轉換率 &amp; AOV</button>
      <button class="tab-btn" onclick="switchTab(this,'ecomCart')">加入購物車</button>
    </div>
    <div id="ecomSessions" class="tab-pane active">
      <div class="chart-wrap"><canvas id="chartEcomSessions"></canvas></div>
    </div>
    <div id="ecomRevTxn" class="tab-pane">
      <div class="chart-wrap"><canvas id="chartEcomRevTxn"></canvas></div>
    </div>
    <div id="ecomCvrAov" class="tab-pane">
      <div class="chart-wrap"><canvas id="chartEcomCvr"></canvas></div>
    </div>
    <div id="ecomCart" class="tab-pane">
      <div class="chart-wrap"><canvas id="chartEcomCart"></canvas></div>
    </div>
  </div>

  <!-- ── 每日總流量趨勢 ── -->
  <div class="section">
    <div class="section-title">每日總流量趨勢（2026年）</div>
    <div class="chart-wrap" style="height:280px;">
      <canvas id="chartDaily"></canvas>
    </div>
  </div>

  <!-- ── 平台趨勢圖 ── -->
  <div class="section">
    <div class="section-title">平台每日趨勢（Web / mWeb / App）</div>
    <div class="chart-wrap">
      <canvas id="chartPlatform"></canvas>
    </div>
  </div>

  <!-- ── Google 媒介趨勢圖 ── -->
  <div class="section">
    <div class="section-title">Google 各媒介每日趨勢</div>
    <div class="chart-wrap">
      <canvas id="chartGoogle"></canvas>
    </div>
  </div>

  <!-- ── Google 各媒介 CVR 分析 ── -->
  <div class="section">
    <div class="section-title">Google 各媒介 CVR 分析（本月 vs 上月）</div>
    <div style="display:grid;grid-template-columns:340px 1fr;gap:28px;align-items:start;">
      <div>
        <div style="position:relative;height:260px;">
          <canvas id="chartGoogleCvr"></canvas>
        </div>
        <div style="font-size:11px;color:#888;text-align:center;margin-top:8px;">綠 ≥ 3% / 橙 1-3% / 紅 &lt; 1%</div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">媒介</th>
              <th>工作階段</th>
              <th>加入購物車</th>
              <th>購買數</th>
              <th>收益</th>
              <th>CVR %</th>
              <th>客單價 AOV</th>
              <th>CVR MOM%</th>
            </tr>
          </thead>
          <tbody>${googleCvrRows}</tbody>
        </table>
        <p style="font-size:11px;color:#888;margin-top:8px;">⚠ 來源 = google，媒介 = sessionMedium；CVR = 購買數 ÷ 工作階段。</p>
      </div>
    </div>
  </div>

  <!-- ── 渠道用戶分布 ── -->
  <div class="section">
    <div class="section-title">流量渠道用戶分布（本月累計 ${dates.thisMonthStart} ～ ${dates.thisMonthEnd}）</div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:28px;align-items:start;">
      <div>
        <div style="position:relative;height:300px;">
          <canvas id="chartChannelDonut"></canvas>
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>渠道群組</th>
              <th>用戶數</th>
              <th>佔比</th>
              <th>工作階段</th>
              <th>新用戶</th>
              <th>MOM%</th>
            </tr>
          </thead>
          <tbody>${channelTableRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── MOM 比較表 ── -->
  <div class="section">
    <div class="section-title">各渠道 MOM 比較</div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'tabDaily')">每日（${dates.yesterday} vs ${dates.lastMonthSameDay}）</button>
      <button class="tab-btn" onclick="switchTab(this,'tabMonthly')">月累計（${dates.thisMonthStart}～${dates.thisMonthEnd} vs ${dates.lastMonthStart}～${dates.lastMonthEnd}）</button>
    </div>
    <div id="tabDaily" class="tab-pane active">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>來源</th><th>當期工作階段</th><th>前期工作階段</th><th>MOM%</th><th>當期用戶</th><th>用戶MOM%</th></tr></thead>
          <tbody>${momTableRows(dailyComparison)}</tbody>
        </table>
      </div>
    </div>
    <div id="tabMonthly" class="tab-pane">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>來源</th><th>當期工作階段</th><th>前期工作階段</th><th>MOM%</th><th>當期用戶</th><th>用戶MOM%</th></tr></thead>
          <tbody>${momTableRows(monthlyComparison)}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── 會員行為分析 ── -->
  <div class="section">
    <div class="section-title">會員行為分析（${dates.thisMonthStart} ～ ${dates.thisMonthEnd}）</div>

    <!-- 行為指標卡片 -->
    <div class="cards" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
      <div class="card">
        <div class="label">跳離率 Bounce Rate</div>
        <div class="value" style="color:${behaviorOverview.bounceRate > 60 ? '#9c0006' : behaviorOverview.bounceRate > 40 ? '#ED7D31' : '#276221'};">${behaviorOverview.bounceRate.toFixed(1)}%</div>
        <div class="sub">越低越好</div>
      </div>
      <div class="card">
        <div class="label">互動率 Engagement Rate</div>
        <div class="value" style="color:${behaviorOverview.engagementRate > 60 ? '#276221' : behaviorOverview.engagementRate > 40 ? '#ED7D31' : '#9c0006'};">${behaviorOverview.engagementRate.toFixed(1)}%</div>
        <div class="sub">越高越好</div>
      </div>
      <div class="card">
        <div class="label">平均工作階段時長</div>
        <div class="value" style="font-size:22px;">${Math.floor(behaviorOverview.avgSessionDuration / 60)}m ${Math.round(behaviorOverview.avgSessionDuration % 60)}s</div>
        <div class="sub">每次造訪平均停留</div>
      </div>
      <div class="card">
        <div class="label">每次工作階段頁面數</div>
        <div class="value">${behaviorOverview.pagesPerSession.toFixed(2)}</div>
        <div class="sub">Pages per Session</div>
      </div>
    </div>

    <!-- 電商漏斗 + 高跳離頁面 -->
    <div class="grid2" style="margin-bottom:24px;">
      <div>
        <div style="font-size:13px;font-weight:700;color:#1F3864;margin-bottom:12px;">📊 電商轉換漏斗</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>步驟</th><th>次數</th><th>步驟轉換率</th></tr></thead>
            <tbody>${funnelRows}</tbody>
          </table>
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#1F3864;margin-bottom:12px;">🚪 高跳離頁面 TOP 15（跳離率排序）</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>頁面路徑</th><th>頁面瀏覽</th><th>跳離率</th><th>互動率</th></tr></thead>
            <tbody>${exitPageRows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 高瀏覽頁面 -->
    <div>
      <div style="font-size:13px;font-weight:700;color:#1F3864;margin-bottom:12px;">📄 瀏覽次數最高頁面 TOP 15</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>頁面路徑</th><th>頁面瀏覽</th><th>平均停留時間</th><th>跳離率</th></tr></thead>
          <tbody>${topPageRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── AI 分析 ── -->
  <div class="section">
    <div class="section-title">AI 洞察分析</div>
    <div class="ai-body">${insightHtml}</div>
  </div>

</div><!-- /container -->

<script>
// ── 電商圖表 ──
const ecomOpts = (y1Label, y2Label) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + c.parsed.y.toLocaleString() } } },
  scales: {
    x:  { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
    y:  { position: 'left',  beginAtZero: false, title: { display: true, text: y1Label }, ticks: { callback: v => Number(v).toLocaleString() } },
    y2: { position: 'right', beginAtZero: false, grid: { drawOnChartArea: false }, title: { display: true, text: y2Label }, ticks: { callback: v => Number(v).toLocaleString() } },
  }
});

new Chart(document.getElementById('chartEcomSessions'), {
  type: 'line',
  data: {
    labels: ${ecomLabels},
    datasets: [
      { label: '全站工作階段', data: ${ecomSessions}, borderColor: '#1F3864', backgroundColor: 'rgba(31,56,100,0.08)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
      { label: 'DoD%', data: ${ecomSessionsDod}, borderColor: '#ED7D31', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, yAxisID: 'y2', borderDash: [4, 3] },
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (c) => c.dataset.yAxisID === 'y2' ? ' DoD: ' + (c.parsed.y != null ? c.parsed.y.toFixed(1) + '%' : '—') : ' 工作階段: ' + c.parsed.y.toLocaleString() } }
    },
    scales: {
      x:  { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y:  { position: 'left',  beginAtZero: false, ticks: { callback: v => Number(v).toLocaleString() } },
      y2: { position: 'right', beginAtZero: false, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }
    }
  }
});

new Chart(document.getElementById('chartEcomRevTxn'), {
  type: 'line',
  data: {
    labels: ${ecomLabels},
    datasets: [
      { label: '總收益', data: ${ecomRevenue}, borderColor: '#1F3864', backgroundColor: 'rgba(31,56,100,0.08)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
      { label: '交易次數', data: ${ecomTxn}, borderColor: '#ED7D31', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false, yAxisID: 'y2' },
    ]
  },
  options: ecomOpts('總收益', '交易次數'),
});

new Chart(document.getElementById('chartEcomCvr'), {
  type: 'line',
  data: {
    labels: ${ecomLabels},
    datasets: [
      { label: 'CVR %', data: ${ecomCvr}, borderColor: '#70AD47', backgroundColor: 'rgba(112,173,71,0.08)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
      { label: 'AOV', data: ${ecomAov}, borderColor: '#FFC000', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false, yAxisID: 'y2' },
    ]
  },
  options: ecomOpts('CVR %', 'AOV'),
});

new Chart(document.getElementById('chartEcomCart'), {
  type: 'bar',
  data: {
    labels: ${ecomLabels},
    datasets: [
      { label: '加入購物車', data: ${ecomCart}, backgroundColor: 'rgba(46,117,182,0.65)', borderColor: '#2E75B6', borderWidth: 1 },
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } }, y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString() } } }
  }
});

// ── 每日總流量趨勢圖 ──
new Chart(document.getElementById('chartDaily'), {
  type: 'line',
  data: {
    labels: ${totalLabels},
    datasets: [
      {
        label: '每日總用戶',
        data: ${totalUsers},
        borderColor: '#1F3864',
        backgroundColor: 'rgba(31,56,100,0.08)',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'DoD%',
        data: ${totalDodArr},
        borderColor: '#ED7D31',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        yAxisID: 'y2',
        borderDash: [4, 3],
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (c) => {
            if (c.dataset.yAxisID === 'y2') return ' DoD: ' + (c.parsed.y != null ? c.parsed.y.toFixed(1) + '%' : '—');
            return ' 用戶: ' + c.parsed.y.toLocaleString();
          }
        }
      }
    },
    scales: {
      x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y:  { position: 'left',  beginAtZero: false, ticks: { callback: (v) => Number(v).toLocaleString() } },
      y2: { position: 'right', beginAtZero: false, grid: { drawOnChartArea: false },
            ticks: { callback: (v) => v + '%' } }
    }
  }
});

// ── 平台趨勢圖 ──
new Chart(document.getElementById('chartPlatform'), {
  type: 'line',
  data: {
    labels: ${platLabels},
    datasets: [
      { label: 'Web',  data: ${platWeb},  borderColor: '#2E75B6', backgroundColor: '#2E75B618', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      { label: 'mWeb', data: ${platMweb}, borderColor: '#ED7D31', backgroundColor: '#ED7D3118', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      { label: 'App',  data: ${platApp},  borderColor: '#70AD47', backgroundColor: '#70AD4718', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + c.parsed.y.toLocaleString() } } },
    scales: {
      x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y: { beginAtZero: false, ticks: { callback: (v) => Number(v).toLocaleString() } }
    }
  }
});

// ── Google 媒介趨勢圖 ──
new Chart(document.getElementById('chartGoogle'), {
  type: 'line',
  data: { labels: ${googleLabels}, datasets: ${googleDatasets} },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + c.parsed.y.toLocaleString() } } },
    scales: {
      x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y: { beginAtZero: false, ticks: { callback: (v) => Number(v).toLocaleString() } }
    }
  }
});

// ── Google 各媒介 CVR 橫條圖 ──
new Chart(document.getElementById('chartGoogleCvr'), {
  type: 'bar',
  data: {
    labels: ${googleCvrLabels},
    datasets: [{
      label: 'CVR %',
      data: ${googleCvrData},
      backgroundColor: ${googleCvrColors},
      borderRadius: 4,
      borderWidth: 0,
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ' CVR: ' + c.parsed.x.toFixed(2) + '%' } }
    },
    scales: {
      x: { beginAtZero: true, ticks: { callback: (v) => v + '%' } },
      y: { ticks: { font: { size: 12 } } }
    }
  }
});

// ── 渠道用戶甜甜圈圖 ──
new Chart(document.getElementById('chartChannelDonut'), {
  type: 'doughnut',
  data: {
    labels: ${chLabels},
    datasets: [{
      data: ${chData},
      backgroundColor: ${chColors},
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (c) => {
            const total = c.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (c.parsed / total * 100).toFixed(1) : '0';
            return \` \${c.label}: \${Number(c.parsed).toLocaleString()} (\${pct}%)\`;
          }
        }
      }
    }
  }
});

// ── Tab 切換 ──
function switchTab(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 商品分類渠道分析 HTML
// ─────────────────────────────────────────────────────────────
import { CategoryChannelRow, AiTrafficRow, AiLandingRow } from './fetchReport.js';

export interface CategoryTabData {
  name: string;
  cur: CategoryChannelRow[];
  prev: CategoryChannelRow[];
  prevFull?: CategoryChannelRow[];
  prevPrevFull?: CategoryChannelRow[];
}

export function generateCategoryHtml(
  categories: CategoryTabData[],
  dates: { thisMonthStart: string; thisMonthEnd: string; thisMonthLastDay: string; lastMonthStart: string; lastMonthEnd: string; lastMonthFullStart: string; lastMonthFullEnd: string; twoMonthsAgoStart: string; twoMonthsAgoEnd: string; twoMonthsAgoLastDay?: string },
): string {
  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const CH_COLORS = ['#2E75B6','#ED7D31','#70AD47','#FFC000','#A550A7','#00B0F0','#FF6B6B','#4BACC6','#7030A0','#A9A9A9'];

  const mom = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
  const momBadge = (pct: number) => {
    const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
    const sign = pct > 0 ? '+' : '';
    return `<span class="badge ${cls}">${sign}${pct.toFixed(1)}%</span>`;
  };

  const buildTab = (tab: CategoryTabData, tabId: string, isActive: boolean, mode: 'cur' | 'prev' | 'prevprev' = 'cur') => {
    const displayRows = mode === 'cur'     ? tab.cur
                      : mode === 'prev'    ? (tab.prevFull ?? tab.prev)
                      :                     (tab.prevPrevFull ?? []);
    const compareRows = mode === 'cur'     ? tab.prev
                      : mode === 'prev'    ? (tab.prevPrevFull ?? null)
                      :                     null;
    const prevMap = compareRows
      ? new Map(compareRows.map((r) => [r.channel, r]))
      : new Map<string, CategoryChannelRow>();

    const sumRows = (rows: CategoryChannelRow[]) =>
      rows.reduce((s, r) => ({ users: s.users + r.users, sessions: s.sessions + r.sessions, addToCarts: s.addToCarts + r.addToCarts, purchases: s.purchases + r.purchases, revenue: s.revenue + r.revenue }), { users: 0, sessions: 0, addToCarts: 0, purchases: 0, revenue: 0 });

    const totDisplay = sumRows(displayRows);
    const totCompare = compareRows ? sumRows(compareRows) : null;
    const cvr = totDisplay.sessions > 0 ? (totDisplay.purchases / totDisplay.sessions * 100) : 0;

    const cardLabel = mode === 'cur'     ? `${dates.thisMonthStart} ～ ${dates.thisMonthLastDay}`
                    : mode === 'prev'    ? `${dates.lastMonthFullStart} ～ ${dates.lastMonthFullEnd}`
                    :                     `${dates.twoMonthsAgoStart} ～ ${dates.twoMonthsAgoEnd}`;
    const momSub = (c: number, p: number | undefined) =>
      p !== undefined ? `<div class="sub">MOM ${momBadge(mom(c, p))}</div>` : '<div class="sub">&nbsp;</div>';

    const donutLabels = JSON.stringify(displayRows.map((r) => r.channel));
    const donutData   = JSON.stringify(displayRows.map((r) => r.users));
    const donutColors = JSON.stringify(displayRows.map((_, i) => CH_COLORS[i % CH_COLORS.length]));

    const tableRows = displayRows.map((r, i) => {
      const p   = prevMap.get(r.channel);
      const rCvr = r.sessions > 0 ? (r.purchases / r.sessions * 100) : 0;
      const dot  = `<span style="display:inline-block;width:10px;height:10px;background:${CH_COLORS[i % CH_COLORS.length]};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>`;
      return `
      <tr>
        <td class="ch-name">${dot}${r.channel}</td>
        <td class="num">${r.users.toLocaleString()}${p ? `<br><small>${momBadge(mom(r.users, p.users))}</small>` : ''}</td>
        <td class="num">${r.sessions.toLocaleString()}${p ? `<br><small>${momBadge(mom(r.sessions, p.sessions))}</small>` : ''}</td>
        <td class="num">${r.addToCarts.toLocaleString()}${p ? `<br><small>${momBadge(mom(r.addToCarts, p.addToCarts))}</small>` : ''}</td>
        <td class="num">${r.purchases.toLocaleString()}${p ? `<br><small>${momBadge(mom(r.purchases, p.purchases))}</small>` : ''}</td>
        <td class="num">NT$ ${Math.round(r.revenue).toLocaleString()}${p ? `<br><small>${momBadge(mom(r.revenue, p.revenue))}</small>` : ''}</td>
        <td class="num ${rCvr >= 3 ? 'cell-up' : rCvr >= 1 ? '' : 'cell-dn'}">${rCvr.toFixed(2)}%</td>
      </tr>`;
    }).join('');

    const momColHeader = compareRows
      ? '<br><small style="font-weight:400;opacity:.8;">MOM%</small>'
      : '';

    return `
  <div id="${tabId}" class="tab-pane${isActive ? ' active' : ''}">
    <div class="cards" style="margin-bottom:24px;">
      <div class="card">
        <div class="label">用戶數（${cardLabel}）</div>
        <div class="value">${totDisplay.users.toLocaleString()}</div>
        ${momSub(totDisplay.users, totCompare?.users)}
      </div>
      <div class="card">
        <div class="label">工作階段（${cardLabel}）</div>
        <div class="value">${totDisplay.sessions.toLocaleString()}</div>
        ${momSub(totDisplay.sessions, totCompare?.sessions)}
      </div>
      <div class="card">
        <div class="label">加入購物車（${cardLabel}）</div>
        <div class="value">${totDisplay.addToCarts.toLocaleString()}</div>
        ${momSub(totDisplay.addToCarts, totCompare?.addToCarts)}
      </div>
      <div class="card">
        <div class="label">購買次數（${cardLabel}）</div>
        <div class="value">${totDisplay.purchases.toLocaleString()}</div>
        ${momSub(totDisplay.purchases, totCompare?.purchases)}
      </div>
      <div class="card">
        <div class="label">收益（${cardLabel}）</div>
        <div class="value" style="font-size:20px;">NT$ ${Math.round(totDisplay.revenue).toLocaleString()}</div>
        ${momSub(totDisplay.revenue, totCompare?.revenue)}
      </div>
      <div class="card">
        <div class="label">整體 CVR</div>
        <div class="value" style="color:${cvr >= 3 ? '#276221' : cvr >= 1 ? '#ED7D31' : '#9c0006'};">${cvr.toFixed(2)}%</div>
        <div class="sub">購買 / 工作階段</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start;">
      <div style="position:relative;height:280px;">
        <canvas id="donut_${tabId}"></canvas>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">渠道</th>
              <th>用戶數${momColHeader}</th>
              <th>工作階段${momColHeader}</th>
              <th>加入購物車${momColHeader}</th>
              <th>購買數${momColHeader}</th>
              <th>收益${momColHeader}</th>
              <th>CVR</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="font-size:11px;color:#aaa;margin-top:8px;">
          ⚠ 數字代表「有觸及 ${tab.name} 商品的工作階段」；CVR = 購買數 ÷ 工作階段。
        </p>
      </div>
    </div>
  </div>
  <script>
  (function(){
    var el = document.getElementById('donut_${tabId}');
    if (!el) return;
    new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ${donutLabels},
        datasets: [{ data: ${donutData}, backgroundColor: ${donutColors}, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => {
            var total = c.dataset.data.reduce(function(a,b){return a+b;},0);
            var pct = total > 0 ? (c.parsed/total*100).toFixed(1) : '0';
            return ' ' + c.label + ': ' + Number(c.parsed).toLocaleString() + ' (' + pct + '%)';
          }}}
        }
      }
    });
  })();
  </script>`;
  };

  // ── 三館合計：依渠道合併 ───────────────────────────────────
  const mergeByChannel = (arrays: CategoryChannelRow[][]): CategoryChannelRow[] => {
    const map = new Map<string, CategoryChannelRow>();
    for (const arr of arrays) {
      for (const row of arr) {
        const e = map.get(row.channel) ?? { channel: row.channel, users: 0, sessions: 0, addToCarts: 0, purchases: 0, revenue: 0 };
        e.users      += row.users;
        e.sessions   += row.sessions;
        e.addToCarts += row.addToCarts;
        e.purchases  += row.purchases;
        e.revenue    += row.revenue;
        map.set(row.channel, e);
      }
    }
    return [...map.values()].sort((a, b) => b.sessions - a.sessions);
  };

  const allTabs: CategoryTabData[] = [
    ...categories,
    {
      name: '三館合計',
      cur:          mergeByChannel(categories.map((c) => c.cur)),
      prev:         mergeByChannel(categories.map((c) => c.prev)),
      prevFull:     mergeByChannel(categories.map((c) => c.prevFull ?? [])),
      prevPrevFull: mergeByChannel(categories.map((c) => c.prevPrevFull ?? [])),
    },
  ];

  const tabButtons = allTabs.map((cat, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" onclick="switchCatTab(this,${i})">${cat.name}</button>`
  ).join('');

  // 本月 panes (cur data, with MOM vs prev)
  const curTabPanes      = allTabs.map((cat, i) => buildTab(cat, `cat${i}`,   i === 0, 'cur'     )).join('');
  // 上月 panes (prevFull data, with MOM vs twoMonthsAgo)
  const prevTabPanes     = allTabs.map((cat, i) => buildTab(cat, `cat${i}p`,  false,   'prev'    )).join('');
  // 上上月 panes (twoMonthsAgo data, no MOM)
  const prevprevTabPanes = allTabs.map((cat, i) => buildTab(cat, `cat${i}pp`, false,   'prevprev')).join('');
  const tabPanes = curTabPanes + prevTabPanes + prevprevTabPanes;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>商品分類渠道分析</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }
  .header { background: linear-gradient(135deg, #4a1a6b 0%, #8e44ad 100%); color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .nav-bar { background: #fff; border-bottom: 2px solid #e0e0e0; padding: 0 32px; display: flex; }
  .nav-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; color: #888; text-decoration: none; border-bottom: 3px solid transparent; display: inline-block; transition: all .15s; }
  .nav-btn:hover { color: #4a1a6b; }
  .nav-btn.active { color: #4a1a6b; border-bottom-color: #8e44ad; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 24px; }
  .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
  .card { background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .label { font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 24px; font-weight: 700; color: #4a1a6b; }
  .card .sub   { font-size: 12px; color: #aaa; margin-top: 6px; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge.up      { background: #e9f7ef; color: #276221; }
  .badge.down    { background: #ffecec; color: #9c0006; }
  .badge.neutral { background: #f0f0f0; color: #888; }
  .section { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #4a1a6b; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #8e44ad; border-radius: 2px; }
  .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
  .tab-btn { padding: 8px 22px; border: 2px solid #d0b8e8; border-radius: 24px; background: #fff; color: #666; cursor: pointer; font-size: 14px; font-weight: 600; transition: all .15s; }
  .tab-btn.active { background: #4a1a6b; color: #fff; border-color: #4a1a6b; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #4a1a6b; color: #fff; padding: 9px 12px; text-align: center; font-weight: 600; white-space: nowrap; }
  th:first-child { text-align: left; min-width: 160px; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  td.ch-name { color: #333; font-weight: 500; }
  td.num { text-align: right; color: #444; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #faf8fc; }
  tr:hover td { background: #f3eefa; }
  .cell-up { color: #276221; font-weight: 600; }
  .cell-dn { color: #9c0006; font-weight: 600; }
  @media (max-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px)  { .cards { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🛍️ 商品分類渠道分析</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">
      本月：${dates.thisMonthStart} ～ ${dates.thisMonthEnd}　｜　對比：${dates.lastMonthStart} ～ ${dates.lastMonthEnd}
    </div>
  </div>
  <div style="font-size:12px;opacity:.75;text-align:right;line-height:1.8;">產生時間：${generatedAt}<br>資料來源：Google Analytics 4</div>
</div>

<div class="nav-bar">
  <a href="report-latest.html"   class="nav-btn">📊 昨日完整報告</a>
  <a href="report-today.html"    class="nav-btn">⚡ 今日概況</a>
  <a href="report-channels.html" class="nav-btn">📈 渠道月趨勢</a>
  <a href="report-category.html" class="nav-btn active">🛍️ 商品分類分析</a>
  <a href="report-promotion.html" class="nav-btn">📍 版位點擊</a>
  <a href="report-ai.html"        class="nav-btn">🤖 AI 流量</a>
  <a href="report-search.html"   class="nav-btn">🔍 搜尋字詞</a>
</div>

<div class="container">
  <div class="section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
      <div class="section-title" style="margin-bottom:0;">各分類 × 渠道轉換表現</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13px;color:#888;font-weight:500;">月份：</span>
        <button class="month-btn active" onclick="switchMonth(this,'cur')"
          style="padding:6px 18px;border:2px solid #4a1a6b;border-radius:20px;background:#4a1a6b;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">
          本月（${dates.thisMonthStart} ～ ${dates.thisMonthLastDay}）
        </button>
        <button class="month-btn" onclick="switchMonth(this,'prev')"
          style="padding:6px 18px;border:2px solid #d0b8e8;border-radius:20px;background:#fff;color:#666;cursor:pointer;font-size:13px;font-weight:600;">
          上月（${dates.lastMonthFullStart} ～ ${dates.lastMonthFullEnd}）
        </button>
        <button class="month-btn" onclick="switchMonth(this,'prevprev')"
          style="padding:6px 18px;border:2px solid #d0b8e8;border-radius:20px;background:#fff;color:#666;cursor:pointer;font-size:13px;font-weight:600;">
          上上月（${dates.twoMonthsAgoStart} ～ ${dates.twoMonthsAgoEnd}）
        </button>
      </div>
    </div>
    <div class="tabs">
      ${tabButtons}
    </div>
    ${tabPanes}
  </div>
</div>

<script>
var _catMode = 'cur';
var _catIdx  = 0;

function switchMonth(btn, mode) {
  _catMode = mode;
  document.querySelectorAll('.month-btn').forEach(function(b){
    b.classList.remove('active');
    b.style.background = '#fff';
    b.style.color = '#666';
    b.style.borderColor = '#d0b8e8';
  });
  btn.classList.add('active');
  btn.style.background = '#4a1a6b';
  btn.style.color = '#fff';
  btn.style.borderColor = '#4a1a6b';
  _showCatPane();
}

function switchCatTab(btn, idx) {
  _catIdx = idx;
  document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  _showCatPane();
}

function _showCatPane() {
  document.querySelectorAll('.tab-pane').forEach(function(p){ p.classList.remove('active'); });
  var suffix = _catMode === 'prev' ? 'p' : _catMode === 'prevprev' ? 'pp' : '';
  var el = document.getElementById('cat' + _catIdx + suffix);
  if (el) el.classList.add('active');
}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 渠道月趨勢 HTML
// ─────────────────────────────────────────────────────────────
import { ChannelMonthlyRow } from './fetchReport.js';

// 固定渠道顏色 map（讓同一渠道在不同圖/月份都保持同色）
const CHANNEL_COLOR_MAP: Record<string, string> = {
  'Organic Search':  '#2E75B6',
  'Paid Search':     '#ED7D31',
  'Direct':          '#70AD47',
  'Organic Social':  '#FFC000',
  'Paid Social':     '#A550A7',
  'Referral':        '#00B0F0',
  'Email':           '#FF6B6B',
  'Affiliates':      '#4BACC6',
  'Display':         '#7030A0',
  '(not set)':       '#A9A9A9',
};
const FALLBACK_COLORS = ['#2E75B6','#ED7D31','#70AD47','#FFC000','#A550A7','#00B0F0','#FF6B6B','#4BACC6','#7030A0','#A9A9A9'];

export function generateChannelTrendHtml(data: ChannelMonthlyRow[]): string {
  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  // ── 整理月份、渠道 ──────────────────────────────────────────
  const allMonths   = [...new Set(data.map((r) => r.yearMonth))].sort();
  const channelTotals = new Map<string, number>();
  data.forEach((r) => channelTotals.set(r.channel, (channelTotals.get(r.channel) ?? 0) + r.users));
  // 依總用戶量排序，最多取 10 個渠道
  const topChannels = [...channelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ch]) => ch);

  // lookup: yearMonth -> channel -> { users, sessions, newUsers }
  const lookup = new Map<string, Map<string, { users: number; sessions: number; newUsers: number }>>();
  data.forEach((r) => {
    if (!lookup.has(r.yearMonth)) lookup.set(r.yearMonth, new Map());
    lookup.get(r.yearMonth)!.set(r.channel, { users: r.users, sessions: r.sessions, newUsers: r.newUsers });
  });

  // ── 顏色分配 ────────────────────────────────────────────────
  const chColor = (ch: string, idx: number) =>
    CHANNEL_COLOR_MAP[ch] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

  // ── 概覽小卡（最新月份）────────────────────────────────────
  const latestMonth  = allMonths[allMonths.length - 1] ?? '';
  const prevMonth    = allMonths[allMonths.length - 2] ?? '';
  const latestData   = lookup.get(latestMonth) ?? new Map();
  const prevData     = lookup.get(prevMonth)   ?? new Map();
  const latestTotal  = [...latestData.values()].reduce((s, v) => s + v.users, 0);
  const prevTotal    = [...prevData.values()].reduce((s, v) => s + v.users, 0);
  const totalMom     = prevTotal > 0 ? ((latestTotal - prevTotal) / prevTotal * 100) : 0;

  // 最大成長 / 最大衰退
  let topGrowth   = { channel: '—', pct: 0 };
  let topDecline  = { channel: '—', pct: 0 };
  topChannels.forEach((ch) => {
    const cur  = latestData.get(ch)?.users ?? 0;
    const prev = prevData.get(ch)?.users  ?? 0;
    if (prev === 0) return;
    const pct = (cur - prev) / prev * 100;
    if (pct > topGrowth.pct)   topGrowth  = { channel: ch, pct };
    if (pct < topDecline.pct)  topDecline = { channel: ch, pct };
  });
  const topChannel = [...latestData.entries()].sort((a, b) => b[1].users - a[1].users)[0];

  // ── Chart.js datasets（用戶數 / 工作階段 / 新用戶）────────────
  const makeDatasets = (metric: 'users' | 'sessions' | 'newUsers') =>
    JSON.stringify(topChannels.map((ch, i) => ({
      label: ch,
      data: allMonths.map((m) => lookup.get(m)?.get(ch)?.[metric] ?? 0),
      borderColor: chColor(ch, i),
      backgroundColor: chColor(ch, i) + '18',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false,
    })));

  const dsUsers    = makeDatasets('users');
  const dsSessions = makeDatasets('sessions');
  const dsNewUsers = makeDatasets('newUsers');
  const monthLabels = JSON.stringify(allMonths.map((m) => m.slice(0, 7)));

  // ── 明細表格（渠道 × 月份）─────────────────────────────────
  const monthHeaders = allMonths.map((m) => `<th>${m}</th>`).join('');
  const tableRows = topChannels.map((ch, i) => {
    const dot = `<span style="display:inline-block;width:10px;height:10px;background:${chColor(ch, i)};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>`;
    const cells = allMonths.map((m, mi) => {
      const v    = lookup.get(m)?.get(ch)?.users ?? 0;
      const prev = mi > 0 ? (lookup.get(allMonths[mi - 1])?.get(ch)?.users ?? 0) : null;
      const pct  = prev !== null && prev > 0 ? ((v - prev) / prev * 100) : null;
      const cls  = pct === null ? '' : pct >= 0 ? 'cell-up' : 'cell-dn';
      const badge = pct !== null ? ` <span style="font-size:10px;color:${pct >= 0 ? '#276221' : '#9c0006'}">${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%</span>` : '';
      return `<td class="num ${m === latestMonth ? 'latest-col' : ''}">${v.toLocaleString()}${badge}</td>`;
    }).join('');
    const latestUsers = latestData.get(ch)?.users ?? 0;
    const prevUsers   = prevData.get(ch)?.users   ?? 0;
    const momPct      = prevUsers > 0 ? ((latestUsers - prevUsers) / prevUsers * 100) : null;
    const momBadge    = momPct !== null
      ? `<span class="badge ${momPct >= 0 ? 'up' : 'down'}">${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%</span>`
      : '<span class="badge neutral">—</span>';
    return `<tr>
      <td class="ch-name">${dot}${ch}</td>
      ${cells}
      <td class="num">${momBadge}</td>
    </tr>`;
  }).join('');

  // ── 合計列 ──────────────────────────────────────────────────
  const totalCells = allMonths.map((m, mi) => {
    const v    = [...(lookup.get(m)?.values() ?? [])].reduce((s, r) => s + r.users, 0);
    const prev = mi > 0 ? [...(lookup.get(allMonths[mi - 1])?.values() ?? [])].reduce((s, r) => s + r.users, 0) : null;
    const pct  = prev !== null && prev > 0 ? ((v - prev) / prev * 100) : null;
    const badge = pct !== null ? ` <span style="font-size:10px;color:${pct >= 0 ? '#276221' : '#9c0006'}">${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%</span>` : '';
    return `<td class="num total-row ${m === latestMonth ? 'latest-col' : ''}" style="font-weight:700;">${v.toLocaleString()}${badge}</td>`;
  }).join('');
  const totalMomBadge = `<span class="badge ${totalMom >= 0 ? 'up' : 'down'}">${totalMom >= 0 ? '+' : ''}${totalMom.toFixed(1)}%</span>`;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>渠道月趨勢</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }

  .header { background: linear-gradient(135deg, #1F3864 0%, #2E75B6 100%); color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }

  .nav-bar { background: #fff; border-bottom: 2px solid #e0e0e0; padding: 0 32px; display: flex; }
  .nav-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; color: #888; text-decoration: none; border-bottom: 3px solid transparent; display: inline-block; transition: all .15s; }
  .nav-btn:hover { color: #1F3864; }
  .nav-btn.active { color: #1F3864; border-bottom-color: #2E75B6; }

  .container { max-width: 1400px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 24px; }

  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 18px 22px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .label { font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 26px; font-weight: 700; color: #1F3864; }
  .card .sub   { font-size: 12px; color: #aaa; margin-top: 6px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge.up      { background: #e9f7ef; color: #276221; }
  .badge.down    { background: #ffecec; color: #9c0006; }
  .badge.neutral { background: #f0f0f0; color: #888; }

  .section { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #1F3864; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #2E75B6; border-radius: 2px; }

  .chart-wrap { position: relative; height: 380px; }

  .tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab-btn { padding: 6px 16px; border: 1.5px solid #d0d8e8; border-radius: 20px; background: #fff; color: #555; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; }
  .tab-btn.active { background: #1F3864; color: #fff; border-color: #1F3864; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }

  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #1F3864; color: #fff; padding: 9px 12px; text-align: center; font-weight: 600; white-space: nowrap; }
  th:first-child { text-align: left; min-width: 160px; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
  td.ch-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; color: #333; font-weight: 500; }
  td.num { text-align: right; color: #444; font-variant-numeric: tabular-nums; }
  td.latest-col { background: #f0f4ff !important; font-weight: 600; }
  td.total-row { background: #f8f9fc !important; border-top: 2px solid #d0d8e8; }
  tr:nth-child(even) td { background: #f8f9fc; }
  tr:hover td { background: #eef2fb; }
  .cell-up { color: #276221; }
  .cell-dn { color: #9c0006; }
  tfoot tr td { background: #eef2f8 !important; font-weight: 700; border-top: 2px solid #2E75B6; }

  @media (max-width: 900px) { .cards { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>📈 渠道流量月趨勢</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">資料範圍：${allMonths[0] ?? ''} ～ ${latestMonth}</div>
  </div>
  <div style="font-size:12px;opacity:.75;text-align:right;line-height:1.8;">產生時間：${generatedAt}<br>資料來源：Google Analytics 4</div>
</div>

<div class="nav-bar">
  <a href="report-latest.html"   class="nav-btn">📊 昨日完整報告</a>
  <a href="report-today.html"    class="nav-btn">⚡ 今日概況</a>
  <a href="report-channels.html" class="nav-btn active">📈 渠道月趨勢</a>
  <a href="report-category.html" class="nav-btn">🛍️ 分類分析</a>
  <a href="report-promotion.html" class="nav-btn">📍 版位點擊</a>
  <a href="report-ai.html"        class="nav-btn">🤖 AI 流量</a>
  <a href="report-search.html"   class="nav-btn">🔍 搜尋字詞</a>
</div>

<div class="container">

  <!-- ── 概覽卡片 ── -->
  <div class="cards">
    <div class="card">
      <div class="label">本月用戶合計</div>
      <div class="value">${latestTotal.toLocaleString()}</div>
      <div class="sub">MOM <span class="badge ${totalMom >= 0 ? 'up' : 'down'}">${totalMom >= 0 ? '+' : ''}${totalMom.toFixed(1)}%</span> vs 上月</div>
    </div>
    <div class="card">
      <div class="label">最大渠道（本月）</div>
      <div class="value" style="font-size:18px;word-break:break-all;">${topChannel?.[0] ?? '—'}</div>
      <div class="sub">${(topChannel?.[1].users ?? 0).toLocaleString()} 用戶</div>
    </div>
    <div class="card">
      <div class="label">最大成長渠道</div>
      <div class="value" style="font-size:18px;color:#276221;word-break:break-all;">${topGrowth.channel}</div>
      <div class="sub"><span class="badge up">+${topGrowth.pct.toFixed(1)}%</span> vs 上月</div>
    </div>
    <div class="card">
      <div class="label">最大衰退渠道</div>
      <div class="value" style="font-size:18px;color:#9c0006;word-break:break-all;">${topDecline.channel}</div>
      <div class="sub"><span class="badge down">${topDecline.pct.toFixed(1)}%</span> vs 上月</div>
    </div>
  </div>

  <!-- ── 折線趨勢圖 ── -->
  <div class="section">
    <div class="section-title">各渠道每月趨勢</div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'tabUsers')">用戶數</button>
      <button class="tab-btn" onclick="switchTab(this,'tabSessions')">工作階段</button>
      <button class="tab-btn" onclick="switchTab(this,'tabNewUsers')">新用戶</button>
    </div>
    <div id="tabUsers"    class="tab-pane active"><div class="chart-wrap"><canvas id="chartUsers"></canvas></div></div>
    <div id="tabSessions" class="tab-pane">        <div class="chart-wrap"><canvas id="chartSessions"></canvas></div></div>
    <div id="tabNewUsers" class="tab-pane">        <div class="chart-wrap"><canvas id="chartNewUsers"></canvas></div></div>
  </div>

  <!-- ── 月份 × 渠道明細表 ── -->
  <div class="section">
    <div class="section-title">月份明細（用戶數，最新月份已標藍底）</div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>渠道</th>
            ${monthHeaders}
            <th>MOM%</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td class="ch-name" style="font-weight:700;">合計</td>
            ${totalCells}
            <td class="num">${totalMomBadge}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

</div>

<script>
const monthLabels = ${monthLabels};
const chartOpts = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'right', labels: { font: { size: 12 }, padding: 12, boxWidth: 14 } },
    tooltip: {
      callbacks: {
        label: (c) => \` \${c.dataset.label}: \${Number(c.parsed.y).toLocaleString()}\`
      }
    }
  },
  scales: {
    x: { ticks: { maxRotation: 0 } },
    y: { beginAtZero: false, ticks: { callback: (v) => Number(v).toLocaleString() } }
  }
});

new Chart(document.getElementById('chartUsers'), {
  type: 'line',
  data: { labels: monthLabels, datasets: ${dsUsers} },
  options: chartOpts('用戶數'),
});

new Chart(document.getElementById('chartSessions'), {
  type: 'line',
  data: { labels: monthLabels, datasets: ${dsSessions} },
  options: chartOpts('工作階段'),
});

new Chart(document.getElementById('chartNewUsers'), {
  type: 'line',
  data: { labels: monthLabels, datasets: ${dsNewUsers} },
  options: chartOpts('新用戶'),
});

function switchTab(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 今日概況 HTML（每小時流量 vs 昨日同時段）
// ─────────────────────────────────────────────────────────────
import { HourlyRow } from './fetchReport.js';

export function generateTodayHtml(
  todayDate: string,
  yesterdayDate: string,
  todayHourly: HourlyRow[],
  yesterdayHourly: HourlyRow[],
  channelToday: ChannelRow[],
): string {
  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  const taipeiNow  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const currentHour = taipeiNow.getHours();

  const SLOTS       = [9, 12, 15, 18, 21];
  const SLOT_LABELS = ['09:00', '12:00', '15:00', '18:00', '21:00'];

  // 累積加總
  const cum = (rows: HourlyRow[], upTo: number) => {
    let sessions = 0, users = 0, pageViews = 0, newUsers = 0;
    for (let h = 0; h <= upTo; h++) {
      sessions  += rows[h]?.sessions  ?? 0;
      users     += rows[h]?.users     ?? 0;
      pageViews += rows[h]?.pageViews ?? 0;
      newUsers  += rows[h]?.newUsers  ?? 0;
    }
    return { sessions, users, pageViews, newUsers };
  };

  const dodBadge = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? `<span class="badge up">新增</span>` : `<span class="badge neutral">—</span>`;
    const pct = ((cur - prev) / prev) * 100;
    return `<span class="badge ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
  };
  const nd = `<td class="num pending">待統計</td>`;

  // ── 概覽卡片數字 ──
  const todayCumNow  = cum(todayHourly,     currentHour);
  const yestCumNow   = cum(yesterdayHourly, currentHour);
  const todayTotSess = todayHourly.reduce((s, r) => s + r.sessions,  0);
  const todayTotPV   = todayHourly.reduce((s, r) => s + r.pageViews, 0);
  const todayTotUser = todayHourly.reduce((s, r) => s + r.users,     0);
  const todayTotNew  = todayHourly.reduce((s, r) => s + r.newUsers,  0);
  const yestTotSess  = yesterdayHourly.reduce((s, r) => s + r.sessions,  0);
  const yestTotPV    = yesterdayHourly.reduce((s, r) => s + r.pageViews, 0);
  const yestTotUser  = yesterdayHourly.reduce((s, r) => s + r.users,     0);

  const soFarDod = yestCumNow.sessions > 0
    ? ((todayCumNow.sessions - yestCumNow.sessions) / yestCumNow.sessions * 100) : 0;
  const lastHourWithData = [...todayHourly].reverse().find(r => r.sessions > 0);

  // ── 重點時段列 ──
  const slotRows = SLOTS.map((h, i) => {
    const tc  = cum(todayHourly, h);
    const yc  = cum(yesterdayHourly, h);
    const th  = todayHourly[h];
    const yh  = yesterdayHourly[h];
    const has = h <= currentHour && tc.sessions > 0;
    return `
    <tr>
      <td class="slot-label">${SLOT_LABELS[i]}</td>
      ${has ? `<td class="num"><strong>${tc.sessions.toLocaleString()}</strong></td>` : nd}
      <td class="num">${yc.sessions.toLocaleString()}</td>
      ${has ? `<td class="num">${dodBadge(tc.sessions, yc.sessions)}</td>` : `<td>—</td>`}
      ${has ? `<td class="num">${th.users.toLocaleString()}</td>` : nd}
      <td class="num">${yh.users.toLocaleString()}</td>
      ${has ? `<td class="num">${dodBadge(th.users, yh.users)}</td>` : `<td>—</td>`}
      ${has ? `<td class="num"><strong>${tc.pageViews.toLocaleString()}</strong></td>` : nd}
      <td class="num">${yc.pageViews.toLocaleString()}</td>
      ${has ? `<td class="num">${dodBadge(tc.pageViews, yc.pageViews)}</td>` : `<td>—</td>`}
    </tr>`;
  }).join('');

  // ── 今日渠道分布資料 ──
  const TCH_COLORS = ['#27ae60','#2E75B6','#ED7D31','#FFC000','#A550A7','#00B0F0','#FF6B6B','#4BACC6','#7030A0','#A9A9A9'];
  const tchTotal = channelToday.reduce((s, r) => s + r.users, 0);
  const todayChannelRows = channelToday.map((r, i) => {
    const pct = tchTotal > 0 ? (r.users / tchTotal * 100).toFixed(1) : '0.0';
    const dot = `<span style="display:inline-block;width:10px;height:10px;background:${TCH_COLORS[i % TCH_COLORS.length]};border-radius:50%;margin-right:6px;"></span>`;
    return `
    <tr>
      <td class="slot-label" style="text-align:left;font-weight:400;font-size:13px;padding-left:12px;">${dot}${r.channel}</td>
      <td class="num">${r.users.toLocaleString()}</td>
      <td class="num">${pct}%</td>
      <td class="num">${r.sessions.toLocaleString()}</td>
    </tr>`;
  }).join('');
  const tchLabels = JSON.stringify(channelToday.map((r) => r.channel));
  const tchData   = JSON.stringify(channelToday.map((r) => r.users));
  const tchColors = JSON.stringify(channelToday.map((_, i) => TCH_COLORS[i % TCH_COLORS.length]));

  // ── 圖表資料 JSON ──
  const chartHours  = JSON.stringify(Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`));
  const tSess  = JSON.stringify(todayHourly.map(r => r.sessions));
  const ySess  = JSON.stringify(yesterdayHourly.map(r => r.sessions));
  const tUsers = JSON.stringify(todayHourly.map(r => r.users));
  const yUsers = JSON.stringify(yesterdayHourly.map(r => r.users));
  const tPV    = JSON.stringify(todayHourly.map(r => r.pageViews));
  const yPV    = JSON.stringify(yesterdayHourly.map(r => r.pageViews));
  const tNew   = JSON.stringify(todayHourly.map(r => r.newUsers));

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>今日流量概況 ${todayDate}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }

  .header { background: linear-gradient(135deg, #1a5c38 0%, #27ae60 100%); color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }

  .nav-bar { background: #fff; border-bottom: 2px solid #e0e0e0; padding: 0 32px; display: flex; }
  .nav-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; color: #888; text-decoration: none; border-bottom: 3px solid transparent; display: inline-block; transition: all .15s; }
  .nav-btn:hover { color: #1a5c38; }
  .nav-btn.active { color: #1a5c38; border-bottom-color: #27ae60; }

  .container { max-width: 1400px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 24px; }

  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 18px 22px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .label { font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 26px; font-weight: 700; color: #1a5c38; }
  .card .sub   { font-size: 12px; color: #aaa; margin-top: 6px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge.up      { background: #e9f7ef; color: #1a5c38; }
  .badge.down    { background: #ffecec; color: #9c0006; }
  .badge.neutral { background: #f0f0f0; color: #888; }

  .section { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #1a5c38; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #27ae60; border-radius: 2px; }

  .chart-wrap { position: relative; height: 340px; }

  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #1a5c38; color: #fff; padding: 8px 10px; text-align: center; font-weight: 600; white-space: nowrap; }
  .th-sub { background: #2e7d32; font-size: 11px; }
  td { padding: 9px 10px; border-bottom: 1px solid #f0f0f0; text-align: center; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.cum { background: #f0faf4 !important; }
  td.pending { color: #bbb; font-style: italic; }
  td.slot-label { font-weight: 700; font-size: 14px; text-align: center; }
  tr:nth-child(even) td { background: #f4fbf7; }
  tr:hover td { background: #e4f5ea; }

  .tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab-btn { padding: 6px 16px; border: 1.5px solid #b2dfdb; border-radius: 20px; background: #fff; color: #555; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; }
  .tab-btn.active { background: #1a5c38; color: #fff; border-color: #1a5c38; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }

  .latency-note { background: #fff8e1; border: 1px solid #ffc107; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #795548; }

  @media (max-width: 900px) { .cards { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>⚡ 今日流量概況</h1>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">日期：${todayDate}　｜　產生時間：${generatedAt}</div>
  </div>
  <div style="font-size:12px;opacity:.8;text-align:right;line-height:1.8;">
    對比基準：${yesterdayDate}<br>資料來源：Google Analytics 4
  </div>
</div>

<div class="nav-bar">
  <a href="report-latest.html"   class="nav-btn">📊 昨日完整報告</a>
  <a href="report-today.html"    class="nav-btn active">⚡ 今日概況</a>
  <a href="report-channels.html" class="nav-btn">📈 渠道月趨勢</a>
  <a href="report-category.html" class="nav-btn">🛍️ 分類分析</a>
  <a href="report-promotion.html" class="nav-btn">📍 版位點擊</a>
  <a href="report-ai.html"        class="nav-btn">🤖 AI 流量</a>
  <a href="report-search.html"   class="nav-btn">🔍 搜尋字詞</a>
</div>

<div class="container">

  <div class="latency-note">
    ⏱ GA4 資料通常有 1–4 小時延遲，若數字偏低屬正常，下個排程時段將自動更新。
    目前台北時間：<strong>${String(currentHour).padStart(2,'0')}:xx</strong>
  </div>

  <!-- ── 概覽卡片（4張）── -->
  <div class="cards">
    <div class="card">
      <div class="label">今日累積工作階段</div>
      <div class="value">${todayCumNow.sessions.toLocaleString()}</div>
      <div class="sub">昨日同時段 ${yestCumNow.sessions.toLocaleString()}
        　${dodBadge(todayCumNow.sessions, yestCumNow.sessions)}</div>
    </div>
    <div class="card">
      <div class="label">今日累積用戶數</div>
      <div class="value">${todayCumNow.users.toLocaleString()}</div>
      <div class="sub">昨日同時段 ${yestCumNow.users.toLocaleString()}
        　${dodBadge(todayCumNow.users, yestCumNow.users)}</div>
    </div>
    <div class="card">
      <div class="label">今日累積頁面瀏覽</div>
      <div class="value">${todayCumNow.pageViews.toLocaleString()}</div>
      <div class="sub">昨日同時段 ${yestCumNow.pageViews.toLocaleString()}
        　${dodBadge(todayCumNow.pageViews, yestCumNow.pageViews)}</div>
    </div>
    <div class="card">
      <div class="label">今日新用戶</div>
      <div class="value">${todayCumNow.newUsers.toLocaleString()}</div>
      <div class="sub">
        佔比 ${todayCumNow.users > 0 ? ((todayCumNow.newUsers / todayCumNow.users) * 100).toFixed(1) : '—'}%
        最新時段：${lastHourWithData != null ? `${String(lastHourWithData.hour).padStart(2,'0')}:00` : '尚無'}
      </div>
    </div>
  </div>

  <!-- ── 重點時段表格 ── -->
  <div class="section">
    <div class="section-title">重點時段對比（今日 vs 昨日）</div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width:80px;">時段</th>
            <th colspan="3" style="background:#1a5c38;">工作階段（00:00 累積）</th>
            <th colspan="3" style="background:#1a5c38;">用戶數（該時段）</th>
            <th colspan="3" style="background:#1a5c38;">頁面瀏覽（00:00 累積）</th>
          </tr>
          <tr>
            <th class="th-sub">今日</th><th class="th-sub">昨日</th><th class="th-sub">DoD</th>
            <th class="th-sub">今日</th><th class="th-sub">昨日</th><th class="th-sub">DoD</th>
            <th class="th-sub">今日</th><th class="th-sub">昨日</th><th class="th-sub">DoD</th>
          </tr>
        </thead>
        <tbody>${slotRows}</tbody>
      </table>
    </div>
  </div>

  <!-- ── 今日渠道用戶分布 ── -->
  <div class="section">
    <div class="section-title">今日流量渠道分布（截至目前）</div>
    <div style="display:grid;grid-template-columns:260px 1fr;gap:24px;align-items:start;">
      <div style="position:relative;height:260px;">
        <canvas id="chartChannelToday"></canvas>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">渠道群組</th>
              <th>用戶數</th>
              <th>佔比</th>
              <th>工作階段</th>
            </tr>
          </thead>
          <tbody>${todayChannelRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── 每小時趨勢圖（3 個 tab）── -->
  <div class="section">
    <div class="section-title">每小時趨勢（今日 vs 昨日）</div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'tabSess')">工作階段</button>
      <button class="tab-btn" onclick="switchTab(this,'tabUsers')">用戶數</button>
      <button class="tab-btn" onclick="switchTab(this,'tabPV')">頁面瀏覽</button>
    </div>
    <div id="tabSess"  class="tab-pane active"><div class="chart-wrap"><canvas id="chartSess"></canvas></div></div>
    <div id="tabUsers" class="tab-pane">        <div class="chart-wrap"><canvas id="chartUsers"></canvas></div></div>
    <div id="tabPV"    class="tab-pane">        <div class="chart-wrap"><canvas id="chartPV"></canvas></div></div>
  </div>

</div>

<script>
const hourLabels = ${chartHours};

function makeBarChart(id, todayData, yestData, label) {
  new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [
        { label: '今日 ${todayDate}',   data: todayData, backgroundColor: 'rgba(39,174,96,0.78)', borderColor: '#1a5c38', borderWidth: 1, borderRadius: 3 },
        { label: '昨日 ${yesterdayDate}', data: yestData,  backgroundColor: 'rgba(46,117,182,0.38)', borderColor: '#2E75B6', borderWidth: 1, borderRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + c.parsed.y.toLocaleString() + ' ' + label } }
      },
      scales: {
        x: { ticks: { maxRotation: 0 } },
        y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString() } }
      }
    }
  });
}

makeBarChart('chartSess',  ${tSess},  ${ySess},  '工作階段');
makeBarChart('chartUsers', ${tUsers}, ${yUsers}, '用戶');
makeBarChart('chartPV',    ${tPV},    ${yPV},    '頁面瀏覽');

// ── 今日渠道甜甜圈圖 ──
new Chart(document.getElementById('chartChannelToday'), {
  type: 'doughnut',
  data: {
    labels: ${tchLabels},
    datasets: [{
      data: ${tchData},
      backgroundColor: ${tchColors},
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (c) => {
            const total = c.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (c.parsed / total * 100).toFixed(1) : '0';
            return \` \${c.label}: \${Number(c.parsed).toLocaleString()} (\${pct}%)\`;
          }
        }
      }
    }
  }
});

function switchTab(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(id).classList.add('active');
}
</script>
</body>
</html>`;
}

// ── 版位促銷點擊分析 HTML ─────────────────────────────────────
const PROMO_GRP: { prefix: string; label: string; color: string }[] = [
  { prefix: 'Home_',   label: '首頁版位',   color: '#2E75B6' },
  { prefix: 'All_',    label: '全站版位',   color: '#ED7D31' },
  { prefix: 'Member_', label: '會員頁版位', color: '#70AD47' },
];
function promoGroup(pid: string): string {
  return PROMO_GRP.find((p) => pid.startsWith(p.prefix))?.label ?? '其他版位';
}

export function generatePromotionHtml(
  datasets: { label: string; rows: PromotionClickRow[] }[],
  defaultDate: string,
): string {
  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  // 清理並序列化所有 datasets 供前端 JS 使用
  const cleanedDatasets = datasets.map((ds) => ({
    label: ds.label,
    rows:  ds.rows.filter((r) => r.promotionId && r.promotionId !== '(not set)'),
  }));
  const datasetsJson = JSON.stringify(cleanedDatasets);
  // 以下只是為了 TypeScript 型別不報錯用的 dummy
  const _dummy = defaultDate;
  void _dummy;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>版位促銷點擊分析</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;color:#222;font-size:14px;}
.header{background:linear-gradient(135deg,#1F3864 0%,#2E75B6 100%);color:#fff;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
.nav-btn{background:rgba(255,255,255,.15);color:#fff;text-decoration:none;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600;border:1.5px solid rgba(255,255,255,.4);}
.nav-btn.active{background:rgba(255,255,255,.95);color:#1F3864;}
.wrap{max-width:1400px;margin:0 auto;padding:24px 16px;}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}
.card{background:#fff;border-radius:10px;padding:18px 20px;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.card .label{font-size:12px;color:#888;margin-bottom:6px;}
.card .value{font-size:24px;font-weight:700;color:#1F3864;}
.card .sub{font-size:12px;color:#555;margin-top:4px;}
.section{background:#fff;border-radius:10px;padding:22px 24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.section-title{font-size:15px;font-weight:700;color:#1F3864;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #eef2f8;}
.ptab-btn{background:none;border:none;border-bottom:3px solid transparent;padding:10px 18px;cursor:pointer;font-size:14px;font-weight:600;color:#555;white-space:nowrap;}
.ptab-btn.active{color:#2E75B6;border-bottom-color:#2E75B6;}
.ptab-pane{display:none;}.ptab-pane.active{display:block;}
.tbl-wrap{overflow-x:auto;}
.range-select{font-size:14px;padding:8px 20px;border-radius:8px;border:2px solid #2E75B6;color:#1F3864;font-weight:700;background:#fff;cursor:pointer;outline:none;}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">📍 版位促銷點擊分析</h1>
    <div id="rangeLabel" style="font-size:13px;opacity:.85;"></div>
  </div>
  <div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
      <a href="report-latest.html" class="nav-btn">📊 昨日完整報告</a>
      <a href="report-today.html" class="nav-btn">⚡ 今日概況</a>
      <a href="report-channels.html" class="nav-btn">📈 渠道月趨勢</a>
      <a href="report-category.html" class="nav-btn">🛍️ 分類分析</a>
      <a href="report-promotion.html" class="nav-btn active">📍 版位點擊</a>
      <a href="report-ai.html" class="nav-btn">🤖 AI 流量</a>
      <a href="report-search.html" class="nav-btn">🔍 搜尋字詞</a>
    </div>
    <div style="font-size:12px;opacity:.75;text-align:right;">產生時間：${generatedAt}<br>資料來源：Google Analytics 4</div>
  </div>
</div>
<div class="wrap">
  <div class="section" style="padding:16px 24px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <span style="font-weight:600;color:#1F3864;">時間區間：</span>
      <select class="range-select" id="rangeSelect" onchange="switchRange(this.value)"></select>
      <span style="font-size:12px;color:#888;">（資料於每日報告產生時更新）</span>
    </div>
  </div>
  <div class="cards" id="cards"></div>
  <div class="section">
    <div class="section-title">各版位促銷點擊明細（點擊版位列可展開素材詳情）</div>
    <div style="display:flex;gap:0;border-bottom:1px solid #e0e8f0;margin-bottom:20px;overflow-x:auto;" id="tabBar"></div>
    <div id="tabContent"></div>
  </div>
</div>

<script>
const DATASETS = ${datasetsJson};
const GROUPS = [
  {prefix:'Home_',   label:'首頁版位',   color:'#2E75B6'},
  {prefix:'All_',    label:'全站版位',   color:'#ED7D31'},
  {prefix:'Member_', label:'會員頁版位', color:'#70AD47'},
  {prefix:'',        label:'其他版位',   color:'#888888'},
];
const chartInstances = {};
let activeTab = 0;

function fmt(n){ return Number(n).toLocaleString(); }
function pct(a,b){ return b > 0 ? (a/b*100).toFixed(1) : '0'; }

function inGroup(row, g, gi){
  if(gi < 3) return row.promotionId.startsWith(g.prefix);
  return !GROUPS.slice(0,3).some(p => row.promotionId.startsWith(p.prefix));
}

function buildTable(rows, grpTotal, totalClicks, uid_prefix){
  if(!rows.length) return '<p style="color:#999;padding:16px;">此分類無資料。</p>';
  const nm = {};
  rows.forEach(r => {
    if(!nm[r.promotionName]) nm[r.promotionName] = {pid:r.promotionId, total:0, items:[]};
    nm[r.promotionName].total += r.clicks;
    nm[r.promotionName].items.push(r);
  });
  const sorted = Object.entries(nm).sort((a,b) => b[1].total - a[1].total);
  const maxT = sorted[0] ? sorted[0][1].total : 1;
  let t = '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f0f4fa;">'
    + '<th style="text-align:left;padding:9px 12px;border-bottom:2px solid #d0d8e8;width:26%;">版位名稱</th>'
    + '<th style="text-align:left;padding:9px 12px;border-bottom:2px solid #d0d8e8;width:30%;">素材名稱</th>'
    + '<th style="text-align:center;padding:9px 12px;border-bottom:2px solid #d0d8e8;width:10%;">槽位</th>'
    + '<th style="text-align:right;padding:9px 12px;border-bottom:2px solid #d0d8e8;width:17%;">點擊次數</th>'
    + '<th style="text-align:right;padding:9px 12px;border-bottom:2px solid #d0d8e8;width:17%;">佔此類%</th>'
    + '</tr></thead><tbody>';
  sorted.forEach(function(entry, gi){
    var name = entry[0], meta = entry[1];
    var uid = uid_prefix + gi;
    var barW = Math.round(meta.total / maxT * 100);
    var bg = gi % 2 === 0 ? '#fff' : '#f9fbff';
    t += '<tr style="background:' + bg + ';border-bottom:1px solid #e8edf4;cursor:pointer;" data-uid="' + uid + '" onclick="toggleRows(this)">'
      + '<td style="padding:9px 12px;font-weight:700;color:#1F3864;"><span class="arr" style="margin-right:6px;font-size:10px;color:#888;display:inline-block;">▶</span>'
      + name + '<div style="font-size:11px;color:#bbb;font-weight:400;">' + meta.pid + '</div></td>'
      + '<td style="padding:9px 12px;"><div style="background:#dce6f4;border-radius:3px;height:7px;width:' + barW + '%;max-width:200px;"></div></td>'
      + '<td style="text-align:center;padding:9px 12px;color:#bbb;">—</td>'
      + '<td style="text-align:right;padding:9px 12px;font-weight:700;color:#1F3864;">' + fmt(meta.total) + '</td>'
      + '<td style="text-align:right;padding:9px 12px;color:#555;">' + pct(meta.total, grpTotal) + '%</td></tr>';
    meta.items.sort(function(a,b){ return b.clicks - a.clicks; }).forEach(function(r){
      var sl = (!r.creativeSlot || r.creativeSlot === 'EMPTY') ? '—' : r.creativeSlot;
      t += '<tr class="detail_' + uid + '" style="display:none;background:#f5f8ff;border-bottom:1px solid #e8edf4;">'
        + '<td style="padding:7px 12px 7px 28px;font-size:12px;color:#bbb;"></td>'
        + '<td style="padding:7px 12px;font-size:12px;color:#333;">' + (r.creativeName || '—') + '</td>'
        + '<td style="text-align:center;padding:7px 12px;font-size:12px;color:#555;">' + sl + '</td>'
        + '<td style="text-align:right;padding:7px 12px;font-size:12px;">' + fmt(r.clicks) + '</td>'
        + '<td style="text-align:right;padding:7px 12px;font-size:12px;color:#888;">' + pct(r.clicks, totalClicks) + '%</td></tr>';
    });
  });
  return t + '</tbody></table>';
}

function renderRange(dsIdx){
  var ds    = DATASETS[dsIdx];
  var rows  = ds.rows;
  var total = rows.reduce(function(s,r){ return s + r.clicks; }, 0);

  document.getElementById('rangeLabel').textContent = ds.label;

  // 卡片
  var cardsHtml = '<div class="card"><div class="label">全站促銷點擊總計</div><div class="value">' + fmt(total) + '</div><div class="sub">' + ds.label + '</div></div>';
  GROUPS.slice(0,3).forEach(function(g){
    var gRows  = rows.filter(function(r){ return r.promotionId.startsWith(g.prefix); });
    var gTotal = gRows.reduce(function(s,r){ return s + r.clicks; }, 0);
    var cnt    = new Set(gRows.map(function(r){ return r.promotionName; })).size;
    cardsHtml += '<div class="card"><div class="label" style="color:' + g.color + ';">' + g.label + '</div>'
      + '<div class="value" style="color:' + g.color + ';">' + fmt(gTotal) + '</div>'
      + '<div class="sub">' + cnt + ' 組・佔 ' + pct(gTotal, total) + '%</div></div>';
  });
  document.getElementById('cards').innerHTML = cardsHtml;

  // 銷毀舊 charts
  Object.keys(chartInstances).forEach(function(k){ try{ chartInstances[k].destroy(); }catch(e){} delete chartInstances[k]; });

  var btnHtml = '', paneHtml = '';
  GROUPS.forEach(function(g, gi){
    var gRows = inGroup ? rows.filter(function(r){ return inGroup(r, g, gi); }) : [];
    var gTotal = gRows.reduce(function(s,r){ return s + r.clicks; }, 0);
    var cnt = new Set(gRows.map(function(r){ return r.promotionName; })).size;
    var isAct = gi === activeTab;
    var uid = 'ds' + dsIdx + 'gi' + gi + 'r';
    var nm2 = {};
    gRows.forEach(function(r){ nm2[r.promotionName] = (nm2[r.promotionName] || 0) + r.clicks; });
    var top10 = Object.entries(nm2).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10);
    GROUPS[gi]._top10  = top10.map(function(e){ return e[0].slice(0,16); });
    GROUPS[gi]._data10 = top10.map(function(e){ return e[1]; });
    btnHtml += '<button class="ptab-btn' + (isAct ? ' active' : '') + '" onclick="switchPTab(this,' + gi + ')" data-color="' + g.color + '" style="' + (isAct ? 'border-bottom-color:' + g.color + ';color:' + g.color + ';' : '') + '">'
      + g.label + ' <span style="font-size:11px;opacity:.65;">' + cnt + ' 組・' + fmt(gTotal) + ' 次</span></button>';
    paneHtml += '<div id="ptab' + gi + '" class="ptab-pane' + (isAct ? ' active' : '') + '">'
      + '<div style="display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start;">'
      + '<div><div style="font-size:12px;color:#888;margin-bottom:8px;">Top 10 版位（點擊次數）</div>'
      + '<div style="position:relative;height:280px;"><canvas id="chartP' + gi + '"></canvas></div></div>'
      + '<div><div style="font-size:13px;color:#888;margin-bottom:12px;">合計 <strong style="color:' + g.color + ';font-size:20px;">' + fmt(gTotal) + '</strong> 次 &nbsp;|&nbsp; 佔全站 <strong>' + pct(gTotal, total) + '%</strong></div>'
      + '<div class="tbl-wrap">' + buildTable(gRows, gTotal, total, uid) + '</div></div></div></div>';
  });
  document.getElementById('tabBar').innerHTML = btnHtml;
  document.getElementById('tabContent').innerHTML = paneHtml;

  // 初始化 charts
  GROUPS.forEach(function(g, gi){
    var el = document.getElementById('chartP' + gi);
    if(!el) return;
    chartInstances['p' + gi] = new Chart(el, {
      type: 'bar',
      data: { labels: g._top10 || [], datasets: [{ label: '點擊', data: g._data10 || [], backgroundColor: g.color + 'bb', borderRadius: 4, borderWidth: 0 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c){ return ' ' + c.parsed.x.toLocaleString() + ' 次'; } } } },
        scales: { x: { beginAtZero: true, ticks: { callback: function(v){ return Number(v).toLocaleString(); } } } } }
    });
  });
}

function switchPTab(btn, gi){
  document.querySelectorAll('.ptab-btn').forEach(function(b){ b.classList.remove('active'); b.style.borderBottomColor='transparent'; b.style.color='#555'; });
  document.querySelectorAll('.ptab-pane').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  var c = btn.dataset.color || '#2E75B6';
  btn.style.borderBottomColor = c; btn.style.color = c;
  document.getElementById('ptab' + gi).classList.add('active');
  activeTab = gi;
  var ci = chartInstances['p' + activeTab];
  if(ci) setTimeout(function(){ ci.resize(); }, 50);
}

function switchRange(val){
  renderRange(parseInt(val));
}

function toggleRows(row){
  var uid = row.dataset.uid;
  var rs = document.querySelectorAll('.detail_' + uid);
  var open = rs[0] && rs[0].style.display !== 'none';
  rs.forEach(function(r){ r.style.display = open ? 'none' : 'table-row'; });
  var arr = row.querySelector('.arr');
  if(arr) arr.textContent = open ? '▶' : '▼';
}

// 初始化下拉選單
var sel = document.getElementById('rangeSelect');
DATASETS.forEach(function(ds, i){
  var opt = document.createElement('option');
  opt.value = i; opt.textContent = ds.label;
  sel.appendChild(opt);
});
renderRange(0);
</script>
</body>
</html>`;
}



// ─────────────────────────────────────────────────────────────
// AI 流量分析 HTML（多時段版）
// ─────────────────────────────────────────────────────────────
interface AiPeriod {
  key:         string;
  label:       string;
  rows:        AiTrafficRow[];
  landingRows: AiLandingRow[];
  startDate:   string;
  endDate:     string;
  revenueOnly?: boolean;
}

export function generateAiHtml(periods: AiPeriod[]): string {
  const generatedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  const SOURCE_LABELS: Record<string, string> = {
    'chat.openai.com':       'ChatGPT',
    'chatgpt.com':           'ChatGPT',
    'perplexity.ai':         'Perplexity',
    'copilot.microsoft.com': 'MS Copilot',
    'gemini.google.com':     'Gemini',
    'claude.ai':             'Claude',
    'you.com':               'You.com',
    'phind.com':             'Phind',
    'poe.com':               'Poe',
    'bing.com':              'Bing/Copilot',
  };
  const SOURCE_COLORS: Record<string, string> = {
    'ChatGPT':      '#10a37f',
    'Perplexity':   '#1fb8cd',
    'MS Copilot':   '#0078d4',
    'Gemini':       '#4285f4',
    'Claude':       '#d4720b',
    'You.com':      '#ff6b35',
    'Phind':        '#6c5ce7',
    'Poe':          '#e84393',
    'Bing/Copilot': '#008272',
  };
  const FALLBACK_COLORS = ['#2E75B6','#ED7D31','#70AD47','#FFC000','#A550A7','#00B0F0','#FF6B6B','#4BACC6'];

  const stripQs = (url: string) => url.split('?')[0].split('#')[0];

  // ── 每個時段產生 content HTML ──
  const chartConfigs: Record<string, string> = {};

  function buildPeriod(p: AiPeriod): string {
    const normalised = p.rows.map((r) => ({ ...r, label: SOURCE_LABELS[r.source] ?? r.source }));
    const allMonths  = [...new Set(normalised.map((r) => r.yearMonth))].sort();
    const sourceTotals    = new Map<string, number>();
    const sourcePurchases = new Map<string, number>();
    const sourceRevenue   = new Map<string, number>();
    normalised.forEach((r) => {
      sourceTotals.set(r.label,    (sourceTotals.get(r.label)    ?? 0) + r.sessions);
      sourcePurchases.set(r.label, (sourcePurchases.get(r.label) ?? 0) + r.purchases);
      sourceRevenue.set(r.label,   (sourceRevenue.get(r.label)   ?? 0) + r.revenue);
    });
    const allSources = p.revenueOnly
      ? [...sourcePurchases.entries()].filter(([,n]) => n > 0).sort((a, b) => b[1] - a[1]).map((e) => e[0])
      : [...sourceTotals.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);

    const matrix = new Map<string, Map<string, { sessions: number; users: number; newUsers: number; purchases: number; revenue: number }>>();
    normalised.forEach((r) => {
      if (!matrix.has(r.yearMonth)) matrix.set(r.yearMonth, new Map());
      const mo  = matrix.get(r.yearMonth)!;
      const cur = mo.get(r.label) ?? { sessions: 0, users: 0, newUsers: 0, purchases: 0, revenue: 0 };
      cur.sessions  += r.sessions;
      cur.users     += r.users;
      cur.newUsers  += r.newUsers;
      cur.purchases += r.purchases;
      cur.revenue   += r.revenue;
      mo.set(r.label, cur);
    });

    const monthTotals = allMonths.map((ym) => {
      const mo = matrix.get(ym);
      return mo ? [...mo.values()].reduce(
        (s, v) => ({ sessions: s.sessions + v.sessions, users: s.users + v.users, newUsers: s.newUsers + v.newUsers, purchases: s.purchases + v.purchases, revenue: s.revenue + v.revenue }),
        { sessions: 0, users: 0, newUsers: 0, purchases: 0, revenue: 0 }
      ) : { sessions: 0, users: 0, newUsers: 0, purchases: 0, revenue: 0 };
    });

    const grandTotal = monthTotals.reduce(
      (s, v) => ({ sessions: s.sessions + v.sessions, users: s.users + v.users, newUsers: s.newUsers + v.newUsers, purchases: s.purchases + v.purchases, revenue: s.revenue + v.revenue }),
      { sessions: 0, users: 0, newUsers: 0, purchases: 0, revenue: 0 }
    );
    const topSource        = allSources[0] ?? '—';
    const topSessions      = sourceTotals.get(topSource) ?? 0;
    const topPurchSrc      = [...sourcePurchases.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—';
    const topPurchSrcN     = sourcePurchases.get(topPurchSrc) ?? 0;
    const cvr              = grandTotal.sessions > 0 ? (grandTotal.purchases / grandTotal.sessions * 100).toFixed(2) : '0.00';
    const aov              = grandTotal.purchases > 0 ? 'NT$ ' + Math.round(grandTotal.revenue / grandTotal.purchases).toLocaleString() : '—';

    // 概覽卡片
    const overviewCards = p.revenueOnly ? `
    <div style="background:#fffbf0;border:1.5px solid #f0c060;border-radius:10px;padding:12px 18px;margin-bottom:16px;font-size:13px;color:#7a5500;">
      💰 此檢視僅顯示<strong>實際帶來訂單與營收</strong>的 AI 流量（2025-01-01 ～ ${p.endDate}）
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
      <div class="card"><div class="label">AI 訂單總數</div><div class="value" style="color:#27ae60;">${grandTotal.purchases.toLocaleString()}</div><div class="sub">有轉換的 AI 工作階段</div></div>
      <div class="card"><div class="label">AI 總營收</div><div class="value" style="color:#e67e22;font-size:20px;">NT$ ${Math.round(grandTotal.revenue).toLocaleString()}</div><div class="sub">平均客單價：${aov}</div></div>
      <div class="card"><div class="label">最佳轉換 AI 來源</div><div class="value" style="font-size:18px;">${topPurchSrc}</div><div class="sub">${topPurchSrcN.toLocaleString()} 筆訂單</div></div>
      <div class="card"><div class="label">有轉換的工作階段</div><div class="value">${grandTotal.sessions.toLocaleString()}</div><div class="sub">帶來營收的 AI sessions</div></div>
      <div class="card"><div class="label">AI 整體 CVR</div><div class="value" style="font-size:22px;">${cvr}%</div><div class="sub">訂單 ÷ Sessions</div></div>
      <div class="card"><div class="label">有轉換 AI 用戶數</div><div class="value">${grandTotal.users.toLocaleString()}</div><div class="sub">2025-01-01 ～ ${p.endDate}</div></div>
    </div>` : `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
      <div class="card"><div class="label">AI 總工作階段</div><div class="value">${grandTotal.sessions.toLocaleString()}</div><div class="sub">${p.startDate} ～ ${p.endDate}</div></div>
      <div class="card"><div class="label">AI 總用戶數</div><div class="value">${grandTotal.users.toLocaleString()}</div><div class="sub">新用戶：${grandTotal.newUsers.toLocaleString()}</div></div>
      <div class="card"><div class="label">最大 AI 來源</div><div class="value" style="font-size:18px;">${topSource}</div><div class="sub">${topSessions.toLocaleString()} sessions</div></div>
      <div class="card"><div class="label">AI 帶來訂單數</div><div class="value" style="color:#27ae60;">${grandTotal.purchases.toLocaleString()}</div><div class="sub">CVR ${cvr}%</div></div>
      <div class="card"><div class="label">AI 帶來營收</div><div class="value" style="color:#e67e22;font-size:20px;">NT$ ${Math.round(grandTotal.revenue).toLocaleString()}</div><div class="sub">每訂單均值：${aov}</div></div>
      <div class="card"><div class="label">AI 平均轉換率</div><div class="value" style="font-size:22px;">${cvr}%</div><div class="sub">訂單 ÷ Sessions</div></div>
    </div>`;

    // 來源卡片
    const sourceCardList = p.revenueOnly
      ? [...sourcePurchases.entries()].filter(([,n]) => n > 0).sort((a,b) => b[1]-a[1])
      : allSources.slice(0, 6).map((s) => [s, sourceTotals.get(s) ?? 0] as [string, number]);
    const sourceCards = sourceCardList.slice(0, 6).map(([src]) => {
      const sess  = sourceTotals.get(src)    ?? 0;
      const purch = sourcePurchases.get(src) ?? 0;
      const rev   = sourceRevenue.get(src)   ?? 0;
      const pct   = grandTotal.sessions > 0 ? (sess / grandTotal.sessions * 100).toFixed(1) : '0';
      const cvrS  = sess > 0 ? (purch / sess * 100).toFixed(2) : '0.00';
      const color = SOURCE_COLORS[src] ?? '#888';
      return p.revenueOnly
        ? `<div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-top:3px solid ${color};">
            <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;margin-bottom:6px;">${src}</div>
            <div style="font-size:20px;font-weight:700;color:#27ae60;">${purch.toLocaleString()} 筆</div>
            <div style="font-size:12px;color:#e67e22;margin-top:4px;font-weight:600;">NT$ ${Math.round(rev).toLocaleString()}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px;">CVR ${cvrS}%・${sess.toLocaleString()} sessions</div>
          </div>`
        : `<div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.07);border-top:3px solid ${color};">
            <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;margin-bottom:6px;">${src}</div>
            <div style="font-size:20px;font-weight:700;color:#1F3864;">${sess.toLocaleString()}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px;">sessions・佔 ${pct}%</div>
          </div>`;
    }).join('');

    // 月份明細表格（多月才顯示）
    let monthlySection = '';
    if (allMonths.length > 1) {
      // revenueOnly：只保留有購買的月份，依營收排序
      const chartMonths = p.revenueOnly
        ? allMonths.filter((ym, i) => monthTotals[i].purchases > 0).sort((a, b) => {
            const ai = allMonths.indexOf(a), bi = allMonths.indexOf(b);
            return monthTotals[bi].revenue - monthTotals[ai].revenue;
          })
        : allMonths;
      const chartTotals = chartMonths.map((ym) => monthTotals[allMonths.indexOf(ym)]);

      const displaySources = p.revenueOnly
        ? allSources.filter((src) => chartMonths.some((ym) => (matrix.get(ym)?.get(src)?.purchases ?? 0) > 0))
        : allSources;

      const srcHeaders = displaySources.map((src) => {
        const color = SOURCE_COLORS[src] ?? '#888';
        const label = p.revenueOnly ? `${src}<br><small>訂單</small>` : src;
        return `<th style="text-align:right;padding:8px 10px;white-space:nowrap;"><span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:50%;margin-right:4px;"></span>${label}</th>`;
      }).join('');

      const tableRows = chartMonths.map((ym) => {
        const mi   = allMonths.indexOf(ym);
        const mo   = matrix.get(ym);
        const tot  = monthTotals[mi];
        const cvrM = tot.sessions > 0 ? (tot.purchases / tot.sessions * 100).toFixed(2) + '%' : '—';
        const srcCells = displaySources.map((src) => {
          const v = p.revenueOnly
            ? (mo?.get(src)?.purchases ?? 0)
            : (mo?.get(src)?.sessions  ?? 0);
          return `<td style="text-align:right;padding:8px 10px;color:#444;">${v > 0 ? v.toLocaleString() : '<span style="color:#ddd;">—</span>'}</td>`;
        }).join('');

        if (p.revenueOnly) {
          return `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:8px 12px;font-weight:600;white-space:nowrap;">${ym.slice(0,4)}/${ym.slice(4,6)}</td>
            <td style="text-align:right;padding:8px 10px;font-weight:700;color:#27ae60;">${tot.purchases.toLocaleString()} 筆</td>
            <td style="text-align:right;padding:8px 10px;color:#e67e22;font-weight:600;">NT$ ${Math.round(tot.revenue).toLocaleString()}</td>
            <td style="text-align:right;padding:8px 10px;color:#888;">${cvrM}</td>
            <td style="text-align:right;padding:8px 10px;color:#555;">${tot.sessions.toLocaleString()}</td>
            ${srcCells}
          </tr>`;
        }
        const prev = mi > 0 ? monthTotals[mi - 1] : null;
        const momPct = prev && prev.sessions > 0 ? ((tot.sessions - prev.sessions) / prev.sessions * 100) : null;
        const momBadge = momPct !== null
          ? `<span style="font-size:11px;padding:2px 5px;border-radius:8px;background:${momPct >= 0 ? '#e9f7ef' : '#ffecec'};color:${momPct >= 0 ? '#276221' : '#9c0006'};font-weight:600;">${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%</span>`
          : '';
        return `<tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:8px 12px;font-weight:600;white-space:nowrap;">${ym.slice(0,4)}/${ym.slice(4,6)}</td>
          <td style="text-align:right;padding:8px 10px;font-weight:700;color:#1F3864;">${tot.sessions.toLocaleString()} ${momBadge}</td>
          <td style="text-align:right;padding:8px 10px;color:#555;">${tot.users.toLocaleString()}</td>
          <td style="text-align:right;padding:8px 10px;color:#27ae60;font-weight:600;">${tot.purchases.toLocaleString()}</td>
          <td style="text-align:right;padding:8px 10px;color:#e67e22;">${tot.revenue > 0 ? 'NT$ ' + Math.round(tot.revenue).toLocaleString() : '—'}</td>
          <td style="text-align:right;padding:8px 10px;color:#888;">${cvrM}</td>
          ${srcCells}
        </tr>`;
      }).reverse().join('');

      // Chart config
      const chartLabels = JSON.stringify(chartMonths.map((ym) => ym.slice(0,4) + '/' + ym.slice(4,6)));
      const barDatasets = p.revenueOnly
        ? JSON.stringify(displaySources.map((src, i) => ({
            label: src,
            data: chartMonths.map((ym) => matrix.get(ym)?.get(src)?.purchases ?? 0),
            backgroundColor: SOURCE_COLORS[src] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            borderRadius: 3, borderWidth: 0,
          })))
        : JSON.stringify(allSources.map((src, i) => ({
            label: src,
            data: allMonths.map((ym) => matrix.get(ym)?.get(src)?.sessions ?? 0),
            backgroundColor: SOURCE_COLORS[src] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            borderRadius: 3, borderWidth: 0,
          })));
      const lineData = JSON.stringify(chartTotals.map((t) => p.revenueOnly ? t.purchases : t.sessions));
      const lineLabel = p.revenueOnly ? '月訂單合計' : '月總計';
      const yLabel   = p.revenueOnly ? '訂單數' : '工作階段';
      chartConfigs[p.key] = `{ labels: ${chartLabels}, bar: ${barDatasets}, line: ${lineData}, lineLabel: "${lineLabel}", yLabel: "${yLabel}" }`;

      const tableHead = p.revenueOnly
        ? `<th style="text-align:left;min-width:70px;">月份</th>
           <th style="text-align:right;min-width:90px;">訂單數</th>
           <th style="text-align:right;min-width:120px;">營收</th>
           <th style="text-align:right;min-width:70px;">CVR%</th>
           <th style="text-align:right;min-width:90px;">AI Sessions</th>
           ${srcHeaders}`
        : `<th style="text-align:left;min-width:70px;">月份</th>
           <th style="text-align:right;min-width:110px;">Sessions<br><small style="font-weight:400;opacity:.8;">MOM%</small></th>
           <th style="text-align:right;min-width:70px;">用戶數</th>
           <th style="text-align:right;min-width:70px;">訂單數</th>
           <th style="text-align:right;min-width:110px;">營收</th>
           <th style="text-align:right;min-width:70px;">CVR%</th>
           ${srcHeaders}`;

      const sectionTitle = p.revenueOnly
        ? `各月 AI 帶來訂單（依營收排序，僅含有購買月份）`
        : `每月 AI 流量趨勢（工作階段）`;
      const chartTitle = p.revenueOnly ? `各月 AI 訂單數（按來源分）` : `每月 AI 流量趨勢（工作階段）`;

      monthlySection = `
      <div class="section">
        <div class="section-title">${chartTitle}</div>
        <div style="position:relative;height:300px;"><canvas id="chart-${p.key}" style="max-height:300px;"></canvas></div>
      </div>
      <div class="section">
        <div class="section-title">${sectionTitle}</div>
        <div class="tbl-wrap"><table>
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
        <p class="note">⚠ bing.com 包含一般 Bing 搜尋流量，實際 Copilot 份額可能較低。部分 AI App 因未傳送 referrer 會被歸入 (direct)，實際 AI 流量可能更高。</p>
      </div>`;
    }

    // 落地頁
    // 過濾無意義的落地頁（登入、首頁、搜尋、購物車等）
    const SKIP_PAGE_PATTERNS = ['/Login', '/login', '/Search', '/search', '/Cart', '/cart', '/Member', '/member', '/Order', '/order'];
    const isUsefulPage = (url: string) => {
      if (!url || url.trim() === '' || url === '(not set)') return false;
      if (url === '/' || url === '') return false;
      if (SKIP_PAGE_PATTERNS.some((pat) => url === pat || url.startsWith(pat + '?') || url.startsWith(pat + '/'))) return false;
      return true;
    };
    // revenueOnly：進一步限縮為實際商品頁（/i/ 路徑）
    const isProductPage = (url: string) => isUsefulPage(url) && (url.includes('/i/') || url.includes('/I/'));

    const landingMap = new Map<string, { sessions: number; users: number; purchases: number; revenue: number; topSource: string; topSourceSessions: number; sources: Map<string, number> }>();
    p.landingRows.forEach((r) => {
      const label = SOURCE_LABELS[r.source] ?? r.source;
      const page  = stripQs(r.landingPage);
      if (p.revenueOnly ? !isProductPage(page) : !isUsefulPage(page)) return;
      const cur   = landingMap.get(page) ?? { sessions: 0, users: 0, purchases: 0, revenue: 0, topSource: '', topSourceSessions: 0, sources: new Map() };
      cur.sessions  += r.sessions;
      cur.users     += r.users;
      cur.purchases += r.purchases;
      cur.revenue   += r.revenue;
      cur.sources.set(label, (cur.sources.get(label) ?? 0) + r.sessions);
      landingMap.set(page, cur);
    });
    landingMap.forEach((v) => {
      let top = ''; let topN = 0;
      v.sources.forEach((n, s) => { if (n > topN) { topN = n; top = s; } });
      v.topSource = top; v.topSourceSessions = topN;
    });
    const topLanding = [...landingMap.entries()]
      .filter(([, v]) => !p.revenueOnly || v.purchases > 0)
      .sort((a, b) => p.revenueOnly ? b[1].revenue - a[1].revenue : b[1].sessions - a[1].sessions)
      .slice(0, 20);

    const landingTableRows = topLanding.map(([page, v], i) => {
      const disp    = page.length > 65 ? page.slice(0, 63) + '…' : page;
      const srcColor = SOURCE_COLORS[v.topSource] ?? '#888';
      const srcPct   = v.sessions > 0 ? (v.topSourceSessions / v.sessions * 100).toFixed(0) : '0';
      const cvrL     = v.sessions > 0 ? (v.purchases / v.sessions * 100).toFixed(2) + '%' : '—';
      return `<tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:8px 10px;color:#aaa;text-align:center;">${i + 1}</td>
        <td style="padding:8px 10px;font-size:11.5px;color:#1F3864;word-break:break-all;" title="${page}">${disp}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;">${v.sessions.toLocaleString()}</td>
        <td style="padding:8px 10px;text-align:right;color:#27ae60;font-weight:600;">${v.purchases > 0 ? v.purchases.toLocaleString() : '—'}</td>
        <td style="padding:8px 10px;text-align:right;color:#e67e22;">${v.revenue > 0 ? 'NT$ ' + Math.round(v.revenue).toLocaleString() : '—'}</td>
        <td style="padding:8px 10px;text-align:right;color:#888;">${cvrL}</td>
        <td style="padding:8px 10px;text-align:center;"><span style="background:${srcColor};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;">${v.topSource}</span> <span style="font-size:11px;color:#aaa;">${srcPct}%</span></td>
      </tr>`;
    }).join('');

    // ── AI 搜尋產生的營收區塊（僅 cur / prev 期間，非 revenueOnly）
    let revenueBlock = '';
    if (!p.revenueOnly && (p.key === 'cur' || p.key === 'prev')) {
      const revSources = [...sourcePurchases.entries()]
        .filter(([, n]) => n > 0)
        .sort((a, b) => (sourceRevenue.get(b[0]) ?? 0) - (sourceRevenue.get(a[0]) ?? 0));

      const revSourceRows = revSources.map(([src]) => {
        const sess  = sourceTotals.get(src)    ?? 0;
        const purch = sourcePurchases.get(src) ?? 0;
        const rev   = sourceRevenue.get(src)   ?? 0;
        const cvrS  = sess > 0 ? (purch / sess * 100).toFixed(2) : '0.00';
        const aovS  = purch > 0 ? 'NT$ ' + Math.round(rev / purch).toLocaleString() : '—';
        const color = SOURCE_COLORS[src] ?? '#888';
        return `<tr style="border-bottom:1px solid #f5e8c0;">
          <td style="padding:9px 12px;"><span style="background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;">${src}</span></td>
          <td style="padding:9px 12px;text-align:right;color:#555;">${sess.toLocaleString()}</td>
          <td style="padding:9px 12px;text-align:right;font-weight:700;color:#27ae60;">${purch.toLocaleString()}</td>
          <td style="padding:9px 12px;text-align:right;color:#e67e22;font-weight:600;">NT$ ${Math.round(rev).toLocaleString()}</td>
          <td style="padding:9px 12px;text-align:right;color:#666;">${cvrS}%</td>
          <td style="padding:9px 12px;text-align:right;color:#888;">${aovS}</td>
        </tr>`;
      }).join('');

      const topRevLanding = [...landingMap.entries()]
        .filter(([, v]) => v.purchases > 0 && isProductPage(v.topSource === '' ? '' : [...landingMap.keys()][0]) || v.purchases > 0)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5);
      const revLandingRows = topRevLanding.map(([page, v]) => {
        const disp   = page.length > 55 ? page.slice(0, 53) + '…' : page;
        const cvrLP  = v.sessions > 0 ? (v.purchases / v.sessions * 100).toFixed(2) : '0.00';
        const color  = SOURCE_COLORS[v.topSource] ?? '#888';
        return `<tr style="border-bottom:1px solid #f5e8c0;">
          <td style="padding:8px 10px;font-size:11.5px;color:#1F3864;word-break:break-all;" title="${page}">${disp}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:#27ae60;">${v.purchases.toLocaleString()}</td>
          <td style="padding:8px 10px;text-align:right;color:#e67e22;font-weight:600;">NT$ ${Math.round(v.revenue).toLocaleString()}</td>
          <td style="padding:8px 10px;text-align:right;color:#666;">${cvrLP}%</td>
          <td style="padding:8px 10px;text-align:center;"><span style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;">${v.topSource}</span></td>
        </tr>`;
      }).join('');

      revenueBlock = `
      <div class="section" style="border:2px solid #f0c060;background:linear-gradient(135deg,#fffef7 0%,#fff8e0 100%);">
        <div class="section-title" style="color:#7a5500;">💰 AI 搜尋帶來的訂單與營收（${p.startDate} ～ ${p.endDate}）</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
          <div class="card" style="border-top:3px solid #27ae60;">
            <div class="label">訂單數</div>
            <div class="value" style="color:#27ae60;">${grandTotal.purchases.toLocaleString()}</div>
            <div class="sub">AI 流量帶來</div>
          </div>
          <div class="card" style="border-top:3px solid #e67e22;">
            <div class="label">總營收</div>
            <div class="value" style="color:#e67e22;font-size:20px;">NT$ ${Math.round(grandTotal.revenue).toLocaleString()}</div>
            <div class="sub">${p.startDate} ～ ${p.endDate}</div>
          </div>
          <div class="card" style="border-top:3px solid #2E75B6;">
            <div class="label">整體 CVR</div>
            <div class="value" style="font-size:22px;">${cvr}%</div>
            <div class="sub">訂單 ÷ Sessions</div>
          </div>
          <div class="card" style="border-top:3px solid #9b59b6;">
            <div class="label">平均客單價</div>
            <div class="value" style="font-size:20px;">${aov}</div>
            <div class="sub">營收 ÷ 訂單數</div>
          </div>
        </div>
        ${grandTotal.purchases > 0 ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#7a5500;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f0c060;">各 AI 來源訂單明細</div>
            <div class="tbl-wrap"><table style="font-size:12px;">
              <thead><tr style="background:#7a5500;">
                <th style="text-align:left;padding:7px 10px;">AI 來源</th>
                <th style="text-align:right;padding:7px 10px;">Sessions</th>
                <th style="text-align:right;padding:7px 10px;">訂單數</th>
                <th style="text-align:right;padding:7px 10px;">營收</th>
                <th style="text-align:right;padding:7px 10px;">CVR%</th>
                <th style="text-align:right;padding:7px 10px;">客單價</th>
              </tr></thead>
              <tbody>${revSourceRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#aaa;">此期間 AI 流量尚無訂單轉換</td></tr>'}</tbody>
            </table></div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#7a5500;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f0c060;">有轉換的落地頁 Top 5</div>
            <div class="tbl-wrap"><table style="font-size:12px;">
              <thead><tr style="background:#7a5500;">
                <th style="text-align:left;padding:7px 10px;">頁面路徑</th>
                <th style="text-align:right;padding:7px 10px;">訂單</th>
                <th style="text-align:right;padding:7px 10px;">營收</th>
                <th style="text-align:right;padding:7px 10px;">CVR%</th>
                <th style="text-align:center;padding:7px 10px;">來源</th>
              </tr></thead>
              <tbody>${revLandingRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#aaa;">無轉換頁面</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>` : '<p style="color:#aaa;font-size:13px;padding:8px 0;">此期間 AI 流量尚無訂單轉換。</p>'}
      </div>`;
    }

    return `
    ${overviewCards}
    ${revenueBlock}
    <div class="section">
      <div class="section-title">各 AI 來源（${p.startDate} ～ ${p.endDate}）</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${sourceCards}</div>
    </div>
    ${monthlySection}
    <div class="section">
      <div class="section-title">AI 流量落地頁 Top 20</div>
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th style="width:36px;">#</th>
          <th style="text-align:left;">頁面路徑</th>
          <th style="text-align:right;min-width:80px;">Sessions</th>
          <th style="text-align:right;min-width:70px;">訂單數</th>
          <th style="text-align:right;min-width:110px;">營收</th>
          <th style="text-align:right;min-width:70px;">CVR%</th>
          <th style="text-align:center;min-width:110px;">主要 AI 來源</th>
        </tr></thead>
        <tbody>${landingTableRows}</tbody>
      </table></div>
      <p class="note">⚑ 主要 AI 來源為帶來最多 sessions 的 AI 平台，後方 % 為其佔此頁面 AI 流量比例。URL 已去除 query string。</p>
    </div>`;
  }

  // ── 建立所有時段 pane ──
  const panes = periods.map((p, i) => {
    const content = buildPeriod(p);
    return `<div id="ai-pane-${p.key}" class="ai-pane" style="display:${i === 0 ? 'block' : 'none'}">${content}</div>`;
  }).join('');

  // Chart configs JSON
  const chartCfgJs = Object.entries(chartConfigs)
    .map(([k, v]) => `"${k}":${v}`)
    .join(',');

  // Tab buttons
  const tabBtns = periods.map((p, i) =>
    `<button class="period-btn${i === 0 ? ' active' : ''}" onclick="switchAiPeriod(this,'${p.key}')">${p.label}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 流量分析</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\/script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }
  .header { background: linear-gradient(135deg, #0d1f3c 0%, #1a3a6b 100%); color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .nav-bar { background: #fff; border-bottom: 2px solid #e0e0e0; padding: 0 32px; display: flex; flex-wrap: wrap; }
  .nav-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; color: #888; text-decoration: none; border-bottom: 3px solid transparent; display: inline-block; transition: all .15s; }
  .nav-btn:hover { color: #1a3a6b; }
  .nav-btn.active { color: #1a3a6b; border-bottom-color: #2E75B6; }
  .period-bar { background: #fff; padding: 12px 32px; border-bottom: 1px solid #e8e8e8; display: flex; gap: 8px; flex-wrap: wrap; }
  .period-btn { padding: 7px 18px; border: 1.5px solid #c5d5ea; border-radius: 20px; background: #fff; color: #555; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
  .period-btn:hover { border-color: #2E75B6; color: #2E75B6; }
  .period-btn.active { background: #1a3a6b; border-color: #1a3a6b; color: #fff; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 20px; }
  .section { background: #fff; border-radius: 10px; padding: 22px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #1a3a6b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #2E75B6; border-radius: 2px; }
  .card { background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .label { font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .value { font-size: 24px; font-weight: 700; color: #1a3a6b; }
  .card .sub   { font-size: 12px; color: #aaa; margin-top: 6px; }
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: #1a3a6b; color: #fff; padding: 9px 10px; text-align: center; font-weight: 600; white-space: nowrap; }
  th:first-child { text-align: left; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #eef3fa; }
  .note { font-size:11px; color:#aaa; margin-top:10px; }
</style>
</head>
<body>
<div class="header">
  <div><h1>🤖 AI 流量分析</h1><div style="font-size:13px;opacity:.85;margin-top:4px;">來自 AI 平台的工作階段、用戶與營收</div></div>
  <div style="font-size:12px;opacity:.75;text-align:right;line-height:1.8;">產生時間：${generatedAt}<br>資料來源：Google Analytics 4</div>
</div>
<div class="nav-bar">
  <a href="report-latest.html"    class="nav-btn">📊 昨日完整報告</a>
  <a href="report-today.html"     class="nav-btn">⚡ 今日概況</a>
  <a href="report-channels.html"  class="nav-btn">📈 渠道月趨勢</a>
  <a href="report-category.html"  class="nav-btn">🛍️ 商品分類分析</a>
  <a href="report-promotion.html" class="nav-btn">📍 版位點擊</a>
  <a href="report-ai.html"        class="nav-btn active">🤖 AI 流量</a>
  <a href="report-search.html"   class="nav-btn">🔍 搜尋字詞</a>
</div>
<div class="period-bar">${tabBtns}</div>
<div class="container">
${panes}
</div>
<script>
var _aiChartInited = {};
var _aiChartCfgs = { ${chartCfgJs} };

function switchAiPeriod(btn, key) {
  document.querySelectorAll('.ai-pane').forEach(function(p){ p.style.display = 'none'; });
  document.querySelectorAll('.period-btn').forEach(function(b){ b.classList.remove('active'); });
  var pane = document.getElementById('ai-pane-' + key);
  if (pane) pane.style.display = 'block';
  btn.classList.add('active');
  if (!_aiChartInited[key] && _aiChartCfgs[key]) {
    _initAiChart(key);
    _aiChartInited[key] = true;
  }
}

function _initAiChart(key) {
  var cfg = _aiChartCfgs[key];
  var ctx = document.getElementById('chart-' + key);
  if (!ctx || !cfg) return;
  var datasets = cfg.bar.slice();
  var lineLabel = cfg.lineLabel || '月總計';
  var yLabel    = cfg.yLabel    || '';
  datasets.push({ label: lineLabel, type: 'line', data: cfg.line, borderColor: '#1F3864', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#1F3864', tension: 0.3, order: -1 });
  new Chart(ctx, {
    type: 'bar',
    data: { labels: cfg.labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: !!yLabel, text: yLabel }, ticks: { callback: function(v){ return Number(v).toLocaleString(); } } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { mode: 'index', callbacks: { label: function(c){ return ' ' + c.dataset.label + ': ' + Number(c.parsed.y).toLocaleString(); } } }
      }
    }
  });
}

// 第一個有 chart 的 period 在頁面載入後初始化
(function(){
  var keys = Object.keys(_aiChartCfgs);
  if (keys.length > 0) { _initAiChart(keys[0]); _aiChartInited[keys[0]] = true; }
})();
<\/script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 站內搜尋字詞排行頁
// ─────────────────────────────────────────────────────────────
import { SearchTermRow } from './fetchReport.js';

interface SearchPeriod {
  key:       string;
  label:     string;
  rows:      SearchTermRow[];
  prevRows:  SearchTermRow[];
}

export function generateSearchHtml(periods: SearchPeriod[], generatedAt: string): string {
  const NAV = `
  <nav class="nav-bar">
    <a class="nav-btn" href="report-latest.html">📊 流量概覽</a>
    <a class="nav-btn" href="report-category.html">🛍️ 三館</a>
    <a class="nav-btn" href="report-position.html">📍 版位點擊</a>
    <a class="nav-btn" href="report-ai.html">🤖 AI 流量</a>
    <a class="nav-btn active" href="report-search.html">🔍 搜尋字詞</a>
  </nav>`;

  const tabBtns = periods.map((p, i) =>
    `<button class="period-btn${i === 0 ? ' active' : ''}" onclick="switchPeriod(this,'${p.key}')">${p.label}</button>`
  ).join('');

  const panes = periods.map((p, i) => {
    const prevMap = new Map<string, { count: number; users: number }>();
    p.prevRows.forEach((r) => prevMap.set(r.term, { count: r.count, users: r.users }));

    const maxCount = p.rows[0]?.count ?? 1;

    const rows = p.rows.map((r, idx) => {
      const rank     = idx + 1;
      const prev     = prevMap.get(r.term);
      const pct      = Math.round(r.count / maxCount * 100);
      let trendHtml  = '';
      if (prev) {
        const diff = r.count - prev.count;
        const pctChg = prev.count > 0 ? ((diff / prev.count) * 100).toFixed(0) : '0';
        if (diff > 0)       trendHtml = `<span style="color:#27ae60;font-size:12px;font-weight:700;">▲ +${diff.toLocaleString()} (${pctChg}%)</span>`;
        else if (diff < 0)  trendHtml = `<span style="color:#e74c3c;font-size:12px;font-weight:700;">▼ ${diff.toLocaleString()} (${pctChg}%)</span>`;
        else                trendHtml = `<span style="color:#aaa;font-size:12px;">─</span>`;
      } else {
        trendHtml = `<span style="background:#f39c12;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;">NEW</span>`;
      }
      const rankStyle = rank <= 3
        ? `font-weight:800;color:${['#f1c40f','#bdc3c7','#cd7f32'][rank-1]};font-size:16px;`
        : 'color:#aaa;';
      return `<tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 14px;text-align:center;${rankStyle}">${rank}</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#1a3a6b;">${r.term}</td>
        <td style="padding:10px 14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;background:#f0f4f8;border-radius:4px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#2E75B6,#4BACC6);border-radius:4px;"></div>
            </div>
            <span style="font-weight:700;color:#1a3a6b;min-width:60px;text-align:right;">${r.count.toLocaleString()}</span>
          </div>
        </td>
        <td style="padding:10px 14px;text-align:right;color:#555;">${r.users.toLocaleString()}</td>
        <td style="padding:10px 14px;">${trendHtml}</td>
      </tr>`;
    }).join('');

    return `<div id="pane-${p.key}" class="pane" style="display:${i === 0 ? 'block' : 'none'}">
      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div class="section-title" style="margin-bottom:0;">搜尋字詞 Top 100（${p.label}）</div>
          <span style="font-size:12px;color:#aaa;">共 ${p.rows.length} 筆 ‧ 趨勢為與對比期間的變化</span>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr>
            <th style="width:50px;text-align:center;">排名</th>
            <th style="text-align:left;">搜尋字詞</th>
            <th style="text-align:left;min-width:220px;">搜尋次數</th>
            <th style="text-align:right;min-width:80px;">用戶數</th>
            <th style="text-align:left;min-width:140px;">趨勢</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="note">⚑ 搜尋次數來自 GA4 <code>search</code> 事件的 eventCount。趨勢比較：當天 vs 前一天、前7天 vs 再前7天。已過濾系統雜訊詞（App / MWeb 等）。</p>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>站內搜尋字詞排行</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #222; font-size: 14px; }
  .header { background: linear-gradient(135deg, #0d1f3c 0%, #1a3a6b 100%); color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .sub { font-size: 13px; color: #a0b4cc; margin-top: 4px; }
  .nav-bar { background: #fff; border-bottom: 2px solid #e0e0e0; padding: 0 32px; display: flex; flex-wrap: wrap; }
  .nav-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; color: #888; text-decoration: none; border-bottom: 3px solid transparent; display: inline-block; transition: all .15s; }
  .nav-btn:hover { color: #1a3a6b; }
  .nav-btn.active { color: #1a3a6b; border-bottom-color: #2E75B6; }
  .period-bar { background: #fff; padding: 12px 32px; border-bottom: 1px solid #e8e8e8; display: flex; gap: 8px; flex-wrap: wrap; }
  .period-btn { padding: 7px 18px; border: 1.5px solid #c5d5ea; border-radius: 20px; background: #fff; color: #555; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
  .period-btn:hover { border-color: #2E75B6; color: #2E75B6; }
  .period-btn.active { background: #1a3a6b; border-color: #1a3a6b; color: #fff; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
  .section { background: #fff; border-radius: 10px; padding: 22px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .section-title { font-size: 15px; font-weight: 700; color: #1a3a6b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #2E75B6; border-radius: 2px; }
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1a3a6b; color: #fff; padding: 10px 14px; font-weight: 600; white-space: nowrap; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #eef3fa; }
  .note { font-size:11px; color:#aaa; margin-top:10px; }
  code { background:#f0f2f5; padding:1px 4px; border-radius:3px; font-size:11px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🔍 站內搜尋字詞排行</h1>
    <div class="sub">資料來源：GA4 search 事件 ‧ 產生時間：${generatedAt}</div>
  </div>
</div>
${NAV}
<div class="period-bar">${tabBtns}</div>
<div class="container">${panes}</div>
<script>
function switchPeriod(btn, key) {
  document.querySelectorAll('.period-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.pane').forEach(function(p){ p.style.display = 'none'; });
  document.getElementById('pane-' + key).style.display = 'block';
}
<\/script>
</body>
</html>`;
}
