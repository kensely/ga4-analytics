/**
 * 搜尋字詞互動查詢 Server
 * 執行：npx tsx src/searchServer.ts
 * 開啟瀏覽器：http://localhost:3737
 */
import http from 'http';
import { URL } from 'url';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

const PORT = 3737;
const NOISE = new Set(['App', 'MWeb', 'app', 'mweb', '', '(not set)']);

async function fetchSearchData(term: string, start: string, end: string) {
  const filterCond: any = {
    filter: {
      fieldName: 'eventName',
      stringFilter: { matchType: 'EXACT', value: 'search' },
    },
  };

  const [res] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'searchTerm' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: filterCond,
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 10000,
  });

  const termLower = term.trim().toLowerCase();
  let rows = (res.rows ?? [])
    .map((r) => ({
      term:  r.dimensionValues?.[0]?.value ?? '',
      count: parseInt(r.metricValues?.[0]?.value ?? '0'),
      users: parseInt(r.metricValues?.[1]?.value ?? '0'),
    }))
    .filter((r) => !NOISE.has(r.term));

  if (termLower) {
    rows = rows.filter((r) => r.term.toLowerCase().includes(termLower));
  } else {
    rows = rows.slice(0, 100);
  }

  return rows.sort((a, b) => b.count - a.count);
}

const PAGE = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ETMALL 搜尋字詞查詢</title>
<style>
  :root {
    --bg: #0f172a; --surface: #1e293b; --border: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8;
    --gold: #fbbf24; --green: #4ade80; --red: #f87171;
    font-family: -apple-system, 'Segoe UI', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); min-height: 100vh; padding: 24px; }
  h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 20px; }
  h1 span { color: var(--accent); }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label { font-size: .8rem; color: var(--muted); font-weight: 500; letter-spacing: .05em; text-transform: uppercase; }
  input[type=text], input[type=date] {
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 8px 12px; font-size: .95rem; outline: none;
    transition: border-color .2s;
  }
  input[type=text] { width: 260px; }
  input[type=date] { width: 160px; }
  input:focus { border-color: var(--accent); }
  .btn {
    background: var(--accent); color: #0f172a; border: none; border-radius: 8px;
    padding: 9px 24px; font-size: .95rem; font-weight: 700; cursor: pointer;
    transition: opacity .2s; white-space: nowrap;
  }
  .btn:hover { opacity: .85; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .shortcuts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .shortcut {
    font-size: .8rem; background: var(--border); color: var(--muted);
    border: none; border-radius: 6px; padding: 4px 12px; cursor: pointer;
    transition: all .2s;
  }
  .shortcut:hover { background: var(--accent); color: #0f172a; }
  #status { color: var(--muted); font-size: .9rem; min-height: 1.4em; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  thead th {
    background: var(--bg); color: var(--muted); text-align: left;
    padding: 10px 14px; font-size: .78rem; letter-spacing: .06em; text-transform: uppercase;
    border-bottom: 1px solid var(--border); position: sticky; top: 0;
  }
  thead th.num { text-align: right; }
  tbody tr { border-bottom: 1px solid rgba(51,65,85,.5); transition: background .15s; }
  tbody tr:hover { background: rgba(56,189,248,.06); }
  td { padding: 10px 14px; }
  td.num { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
  td.bar-cell { width: 120px; }
  .bar-wrap { background: rgba(255,255,255,.08); border-radius: 4px; height: 8px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #38bdf8, #818cf8); transition: width .4s; }
  .rank { font-weight: 700; width: 2.5rem; display: inline-block; text-align: center; }
  .rank.gold   { color: var(--gold); }
  .rank.silver { color: #94a3b8; }
  .rank.bronze { color: #b45309; }
  .summary { display: flex; gap: 16px; font-size: .85rem; color: var(--muted); margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
  .summary b { color: var(--text); }
  .empty { text-align: center; color: var(--muted); padding: 40px; font-size: 1rem; }
</style>
</head>
<body>
<h1>🔍 ETMALL 搜尋字詞查詢 <span>互動工具</span></h1>

<div class="card">
  <div class="form-row">
    <div class="field">
      <label>搜尋字詞</label>
      <input type="text" id="term" placeholder="留空顯示 Top 100" />
    </div>
    <div class="field">
      <label>開始日期</label>
      <input type="date" id="startDate" />
    </div>
    <div class="field">
      <label>結束日期</label>
      <input type="date" id="endDate" />
    </div>
    <button class="btn" id="searchBtn" onclick="doSearch()">查詢</button>
  </div>
  <div class="shortcuts" style="margin-top:14px;">
    <span style="font-size:.8rem;color:var(--muted);line-height:2;">快捷：</span>
    <button class="shortcut" onclick="setRange(0,0)">今天</button>
    <button class="shortcut" onclick="setRange(1,1)">昨天</button>
    <button class="shortcut" onclick="setRange(6,0)">近7天</button>
    <button class="shortcut" onclick="setRange(29,0)">近30天</button>
    <button class="shortcut" onclick="setRange(89,0)">近90天</button>
    <button class="shortcut" onclick="setMonthRange(0)">本月</button>
    <button class="shortcut" onclick="setMonthRange(1)">上月</button>
  </div>
</div>

<div class="card">
  <div id="status">請輸入查詢條件後按「查詢」</div>
  <div id="result"></div>
</div>

<script>
  const tz = 'Asia/Taipei';
  function toDate(d) {
    return d.toLocaleDateString('sv-SE', { timeZone: tz });
  }
  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }
  function today() { return new Date(new Date().toLocaleString('en-US', { timeZone: tz })); }

  function setRange(daysBack, endDaysBack) {
    const t = today();
    document.getElementById('startDate').value = toDate(addDays(t, -daysBack));
    document.getElementById('endDate').value   = toDate(addDays(t, -endDaysBack));
  }
  function setMonthRange(monthsBack) {
    const t = today();
    const y = t.getFullYear();
    const m = t.getMonth() - monthsBack;
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0);
    document.getElementById('startDate').value = toDate(start);
    document.getElementById('endDate').value   = toDate(end > t ? t : end);
  }

  // 預設近30天
  setRange(30, 1);

  document.getElementById('term').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  async function doSearch() {
    const term  = document.getElementById('term').value.trim();
    const start = document.getElementById('startDate').value;
    const end   = document.getElementById('endDate').value;

    if (!start || !end) { alert('請選擇日期範圍'); return; }
    if (start > end)    { alert('開始日期不能晚於結束日期'); return; }

    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.textContent = '查詢中…';
    document.getElementById('status').textContent = '正在向 GA4 查詢，請稍候...';
    document.getElementById('result').innerHTML = '';

    try {
      const params = new URLSearchParams({ term, start, end });
      const res = await fetch('/api/search?' + params);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      renderResult(data, term, start, end);
    } catch (e) {
      document.getElementById('status').textContent = '查詢失敗：' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '查詢';
    }
  }

  function renderResult(rows, term, start, end) {
    const label = term ? \`包含「\${term}」\` : 'Top 100';
    const rangeLabel = \`\${start} ～ \${end}\`;
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const totalUsers = rows.reduce((s, r) => s + r.users, 0);
    const maxCount   = rows.length > 0 ? rows[0].count : 1;

    if (rows.length === 0) {
      document.getElementById('status').textContent = '';
      document.getElementById('result').innerHTML =
        \`<div class="empty">❌ 查無 \${label} 的搜尋資料（\${rangeLabel}）</div>\`;
      return;
    }

    const rankIcon = (i) => {
      if (i === 0) return '<span class="rank gold">🥇</span>';
      if (i === 1) return '<span class="rank silver">🥈</span>';
      if (i === 2) return '<span class="rank bronze">🥉</span>';
      return \`<span class="rank">\${i + 1}</span>\`;
    };

    const rows_html = rows.map((r, i) => {
      const pct = maxCount > 0 ? (r.count / maxCount * 100).toFixed(1) : 0;
      return \`<tr>
        <td>\${rankIcon(i)}</td>
        <td>\${r.term}</td>
        <td class="num">\${r.count.toLocaleString()}</td>
        <td class="num">\${r.users.toLocaleString()}</td>
        <td class="bar-cell">
          <div class="bar-wrap"><div class="bar-fill" style="width:\${pct}%"></div></div>
        </td>
      </tr>\`;
    }).join('');

    document.getElementById('status').textContent = '';
    document.getElementById('result').innerHTML = \`
      <table>
        <thead>
          <tr>
            <th style="width:3.5rem">#</th>
            <th>搜尋字詞</th>
            <th class="num">搜尋次數</th>
            <th class="num">用戶數</th>
            <th class="num">相對量</th>
          </tr>
        </thead>
        <tbody>\${rows_html}</tbody>
      </table>
      <div class="summary">
        找到 <b>\${rows.length}</b> 個字詞 ·
        合計搜尋 <b>\${totalCount.toLocaleString()}</b> 次 ·
        觸及用戶 <b>\${totalUsers.toLocaleString()}</b> 人 ·
        時間範圍 <b>\${rangeLabel}</b>
      </div>
    \`;
  }
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }

  if (url.pathname === '/api/search') {
    const term  = url.searchParams.get('term')  ?? '';
    const start = url.searchParams.get('start') ?? '30daysAgo';
    const end   = url.searchParams.get('end')   ?? 'yesterday';

    try {
      const rows = await fetchSearchData(term, start, end);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(rows));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(e.message);
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   ETMALL 搜尋字詞互動查詢工具                               ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`\n  ✅ Server 啟動成功！`);
  console.log(`  🌐 請開啟瀏覽器前往：http://localhost:${PORT}`);
  console.log(`\n  （Ctrl+C 可關閉 server）\n`);
});
