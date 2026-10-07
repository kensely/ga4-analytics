/**
 * 輸出全球購分析資料 → reports/global-brief.md
 * 執行方式：npx tsx src/exportGlobalReport.ts
 */
import fs from 'fs';
import path from 'path';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.join(__dirname, '..', 'reports');

const GLOBAL_CATEGORIES = ['生活館', '免運館', '好康館'];
const SITE_DOMAIN    = 'etmall.com.tw';
const SEARCH_DOMAINS = ['google', 'yahoo', 'bing', 'baidu', 'duckduckgo', 'naver', 'syndicatedsearch.goog'];

async function fetchMonthlyCvr() {
  const [res] = await analyticsDataClient.runReport({
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
      filter: { fieldName: 'itemCategory', inListFilter: { values: GLOBAL_CATEGORIES, caseSensitive: true } },
    },
    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    limit: 50,
  });
  return (res.rows ?? []).map((r) => ({
    yearMonth: r.dimensionValues?.[0]?.value ?? '',
    sessions:  parseInt(r.metricValues?.[0]?.value ?? '0'),
    users:     parseInt(r.metricValues?.[1]?.value ?? '0'),
    purchases: parseInt(r.metricValues?.[2]?.value ?? '0'),
    revenue:   parseFloat(r.metricValues?.[3]?.value ?? '0'),
  }));
}

async function fetchGlobalByChannel() {
  const [res] = await analyticsDataClient.runReport({
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
      filter: { fieldName: 'itemCategory', inListFilter: { values: GLOBAL_CATEGORIES, caseSensitive: true } },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  });
  return (res.rows ?? []).map((r) => ({
    channel:   r.dimensionValues?.[0]?.value ?? '',
    sessions:  parseInt(r.metricValues?.[0]?.value ?? '0'),
    users:     parseInt(r.metricValues?.[1]?.value ?? '0'),
    purchases: parseInt(r.metricValues?.[2]?.value ?? '0'),
    revenue:   parseFloat(r.metricValues?.[3]?.value ?? '0'),
  }));
}

async function fetchGlobalReferrers() {
  const [res] = await analyticsDataClient.runReport({
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
  return (res.rows ?? []).map((r) => ({
    ref: r.dimensionValues?.[0]?.value ?? '',
    cnt: parseInt(r.metricValues?.[0]?.value ?? '0'),
  }));
}

function classifyReferrer(ref: string): string {
  if (!ref || ref.trim() === '' || ref === '(not set)') return '直接進入 / App';
  const lower = ref.toLowerCase();
  if (lower.includes(SITE_DOMAIN))                      return '站內路徑';
  if (SEARCH_DOMAINS.some((d) => lower.includes(d)))    return '站外搜尋';
  if (lower.includes('android-app://com.google'))       return '站外搜尋';
  if (lower.includes('facebook') || lower.includes('threads') || lower.includes('instagram')) return '社群媒體';
  if (lower.includes('line.android') || lower.includes('jp.naver.line')) return '社群媒體';
  if (lower.includes('youtube'))                        return '社群媒體';
  if (lower.includes('criteo') || lower.includes('doubleclick') || lower.includes('scupio') || lower.includes('creativecdn') || lower.includes('rtbhouse')) return '廣告平台';
  if (lower.includes('shopee') || lower.includes('etmall') || lower.includes('feebee') || lower.includes('biggo') || lower.includes('shopback')) return '購物/比價平台';
  return '其他外站';
}

async function main() {
  const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

  console.log('正在抓取資料...');
  const [cvrRows, chRows, refRows] = await Promise.all([
    fetchMonthlyCvr(),
    fetchGlobalByChannel(),
    fetchGlobalReferrers(),
  ]);

  // ── 月度 CVR ──
  let prevCvr = 0;
  const cvrTable = cvrRows.map((r) => {
    const cvr   = r.sessions > 0 ? r.purchases / r.sessions * 100 : 0;
    const mom   = prevCvr > 0 ? ((cvr - prevCvr) / prevCvr * 100).toFixed(1) : '—';
    const label = r.yearMonth.slice(0, 4) + '-' + r.yearMonth.slice(4, 6);
    const rev   = (r.revenue / 10000).toFixed(1);
    const out   = { label, sessions: r.sessions, users: r.users, purchases: r.purchases, cvr: cvr.toFixed(2), momCvr: mom, revW: rev };
    prevCvr     = cvr;
    return out;
  });

  // ── 渠道 ──
  const totalSessions  = chRows.reduce((s, r) => s + r.sessions, 0);
  const totalPurchases = chRows.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue   = chRows.reduce((s, r) => s + r.revenue, 0);

  // ── 流量來源分類 ──
  const totalEvents = refRows.reduce((s, r) => s + r.cnt, 0);
  const buckets     = new Map<string, number>();
  refRows.forEach((r) => {
    const cat = classifyReferrer(r.ref);
    buckets.set(cat, (buckets.get(cat) ?? 0) + r.cnt);
  });
  const sortedBuckets = [...buckets.entries()].sort((a, b) => b[1] - a[1]);

  // ══════════════════════════
  // 輸出 Markdown
  // ══════════════════════════
  const md: string[] = [];

  md.push(`# 全球購商品 GA4 分析資料`);
  md.push(`> 資料來源：Google Analytics 4｜匯出日期：${today}`);
  md.push(`> 商品分類：生活館 / 免運館 / 好康館（etmall.com.tw 全球購）`);
  md.push('');
  md.push('---');
  md.push('');

  // 1. 月度 CVR
  md.push('## 一、月度 CVR 趨勢（2025-01 ～ 最新）');
  md.push('');
  md.push('| 月份 | Sessions | 用戶數 | 訂單數 | CVR% | MOM CVR | 營收（萬元） |');
  md.push('|------|---------|-------|-------|------|---------|------------|');
  cvrTable.forEach((r) => {
    md.push(`| ${r.label} | ${r.sessions.toLocaleString()} | ${r.users.toLocaleString()} | ${r.purchases.toLocaleString()} | ${r.cvr}% | ${r.momCvr}% | ${r.revW} |`);
  });
  md.push('');
  md.push('**說明：**');
  md.push('- CVR = 訂單數 ÷ Sessions × 100%');
  md.push('- MOM CVR = 與上個月 CVR 的變化幅度');
  md.push('- 2026-02 的營收數字異常偏高（1320 萬），建議核實是否有資料問題');
  md.push('');
  md.push('---');
  md.push('');

  // 2. 渠道分布
  md.push('## 二、渠道分布（2026-01-01 ～ 今）');
  md.push('');
  md.push('| 渠道 | Sessions | 佔比 | 訂單數 | CVR% | 營收（萬元） |');
  md.push('|------|---------|-----|-------|------|------------|');
  chRows.forEach((r) => {
    const pct = totalSessions > 0 ? (r.sessions / totalSessions * 100).toFixed(1) : '0';
    const cvr = r.sessions > 0 ? (r.purchases / r.sessions * 100).toFixed(2) : '0.00';
    const rev = (r.revenue / 10000).toFixed(1);
    md.push(`| ${r.channel} | ${r.sessions.toLocaleString()} | ${pct}% | ${r.purchases.toLocaleString()} | ${cvr}% | ${rev} |`);
  });
  const totalCvr = totalSessions > 0 ? (totalPurchases / totalSessions * 100).toFixed(2) : '0';
  md.push(`| **合計** | **${totalSessions.toLocaleString()}** | **100%** | **${totalPurchases.toLocaleString()}** | **${totalCvr}%** | **${(totalRevenue / 10000).toFixed(1)}** |`);
  md.push('');
  md.push('**渠道說明：**');
  md.push('- Direct：書籤、App 內直接跳轉、輸入網址');
  md.push('- Organic Search：Google/Yahoo/Bing 自然搜尋');
  md.push('- Organic Social：FB/LINE/Threads 等社群自然流量');
  md.push('- Cross-network：跨網路再行銷廣告（Performance Max 等）');
  md.push('- Paid Search：搜尋關鍵字廣告');
  md.push('- Organic Shopping：Google Shopping 自然列表');
  md.push('');
  md.push('---');
  md.push('');

  // 3. 流量來源分類
  md.push('## 三、商品瀏覽流量來源分類（2026-01-01 ～ 今）');
  md.push('');
  md.push('> 以 view_item（商品瀏覽）事件計算，共 ' + totalEvents.toLocaleString() + ' 次');
  md.push('');
  md.push('| 來源分類 | 事件次數 | 佔比 |');
  md.push('|---------|---------|-----|');
  sortedBuckets.forEach(([cat, cnt]) => {
    const pct = (cnt / totalEvents * 100).toFixed(1);
    md.push(`| ${cat} | ${cnt.toLocaleString()} | ${pct}% |`);
  });
  md.push('');
  md.push('**分類規則：**');
  md.push('- 站外搜尋：pageReferrer 含 google / yahoo / bing / syndicatedsearch');
  md.push('- 站內路徑：pageReferrer 含 etmall.com.tw');
  md.push('- 社群媒體：pageReferrer 含 facebook / threads / line / youtube');
  md.push('- 廣告平台：pageReferrer 含 criteo / doubleclick / rtbhouse / scupio');
  md.push('- 直接進入/App：pageReferrer 為空（包含 App 跳轉、書籤、LINE 推播等）');
  md.push('');
  md.push('---');
  md.push('');

  // 4. 給 Claude 的 Context
  md.push('## 四、背景說明（提供給 Claude 的 Context）');
  md.push('');
  md.push('- **平台**：etmall.com.tw（東森購物）');
  md.push('- **全球購定義**：以 GA4 的 `item_category` 維度，篩選值為「生活館」、「免運館」、「好康館」的商品，這三個分類涵蓋全球購品項');
  md.push('- **CVR 計算**：訂單數（ecommercePurchases）÷ Sessions');
  md.push('- **流量來源**：使用 `pageReferrer` 維度分析用戶在瀏覽商品前的上一個頁面來源，空白 referrer 通常來自 App 內跳轉、書籤或 LINE 推播');
  md.push('- **分析目的**：製作全球購業績簡報，需要說明 CVR 趨勢變化與流量結構');
  md.push('');

  const outPath = path.join(reportsDir, 'global-brief.md');
  fs.writeFileSync(outPath, md.join('\n'), 'utf-8');
  console.log(`\n✅ 已輸出：reports/global-brief.md`);
  console.log(`   可直接將此檔案的內容貼給 Claude 進行簡報撰寫`);
}

main().catch(console.error);
