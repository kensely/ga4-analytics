import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';

export interface SessionSourceRow {
  sessionSource: string;
  sessions: number;
  users: number;
  newUsers: number;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateRanges() {
  const today = new Date();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // 上個月同一天
  const lastMonthSameDay = new Date(yesterday);
  lastMonthSameDay.setMonth(lastMonthSameDay.getMonth() - 1);

  // 本月 1 號到昨天
  const thisMonthStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);

  // 上個月 1 號到同期（同樣天數，用於同期對比）
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthSamePeriodEnd = new Date(lastMonthStart);
  lastMonthSamePeriodEnd.setDate(yesterday.getDate());

  // 本月最後一天
  const thisMonthLastDay = new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0);

  // 上個月完整（1 號到月底）
  const lastMonthFullStart = new Date(yesterday.getFullYear(), yesterday.getMonth() - 1, 1);
  const lastMonthFullEnd   = new Date(yesterday.getFullYear(), yesterday.getMonth(), 0);

  // 兩個月前完整（1 號到月底）
  const twoMonthsAgoStart = new Date(yesterday.getFullYear(), yesterday.getMonth() - 2, 1);
  const twoMonthsAgoEnd   = new Date(yesterday.getFullYear(), yesterday.getMonth() - 1, 0);

  // 搜尋字詞比較用：前一天 / 再前7天
  const dayBeforeYesterday = new Date(yesterday);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
  const prev7End   = new Date(yesterday);
  prev7End.setDate(prev7End.getDate() - 7);
  const prev7Start = new Date(prev7End);
  prev7Start.setDate(prev7Start.getDate() - 6);

  return {
    yesterday: formatDate(yesterday),
    lastMonthSameDay: formatDate(lastMonthSameDay),
    thisMonthStart: formatDate(thisMonthStart),
    thisMonthEnd: formatDate(yesterday),
    lastMonthStart: formatDate(lastMonthStart),
    lastMonthEnd: formatDate(lastMonthSamePeriodEnd),
    thisMonthLastDay:   formatDate(thisMonthLastDay),
    lastMonthFullStart: formatDate(lastMonthFullStart),
    lastMonthFullEnd:   formatDate(lastMonthFullEnd),
    twoMonthsAgoStart:  formatDate(twoMonthsAgoStart),
    twoMonthsAgoEnd:    formatDate(twoMonthsAgoEnd),
    dayBeforeYesterday: formatDate(dayBeforeYesterday),
    prev7Start:         formatDate(prev7Start),
    prev7End:           formatDate(prev7End),
  };
}

async function fetchByDateRange(startDate: string, endDate: string): Promise<SessionSourceRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    sessionSource: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    newUsers: parseInt(row.metricValues?.[2]?.value ?? '0'),
  }));
}

export async function fetchYesterdayReport() {
  const dates = getDateRanges();
  return fetchByDateRange(dates.yesterday, dates.yesterday);
}

export async function fetchLastMonthSameDayReport() {
  const dates = getDateRanges();
  return fetchByDateRange(dates.lastMonthSameDay, dates.lastMonthSameDay);
}

export async function fetchThisMonthReport() {
  const dates = getDateRanges();
  return fetchByDateRange(dates.thisMonthStart, dates.thisMonthEnd);
}

export async function fetchLastMonthSamePeriodReport() {
  const dates = getDateRanges();
  return fetchByDateRange(dates.lastMonthStart, dates.lastMonthEnd);
}

export interface GoogleChannelRow {
  medium: string;
  sessions: number;
  users: number;
  newUsers: number;
}

async function fetchGoogleByDateRange(startDate: string, endDate: string): Promise<GoogleChannelRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'EXACT', value: 'google' },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    medium: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    newUsers: parseInt(row.metricValues?.[2]?.value ?? '0'),
  }));
}

export async function fetchGoogleChannelYesterday(): Promise<GoogleChannelRow[]> {
  const dates = getDateRanges();
  return fetchGoogleByDateRange(dates.yesterday, dates.yesterday);
}

export async function fetchGoogleChannelLastMonthSameDay(): Promise<GoogleChannelRow[]> {
  const dates = getDateRanges();
  return fetchGoogleByDateRange(dates.lastMonthSameDay, dates.lastMonthSameDay);
}

export async function fetchGoogleChannelThisMonth(): Promise<GoogleChannelRow[]> {
  const dates = getDateRanges();
  return fetchGoogleByDateRange(dates.thisMonthStart, dates.thisMonthEnd);
}

export async function fetchGoogleChannelLastMonthSamePeriod(): Promise<GoogleChannelRow[]> {
  const dates = getDateRanges();
  return fetchGoogleByDateRange(dates.lastMonthStart, dates.lastMonthEnd);
}

export interface GoogleDailyRow {
  date: string;
  sessions: number;
  users: number;
}

export async function fetchGoogleDailySince(startDate: string): Promise<GoogleDailyRow[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = formatDate(yesterday);

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'EXACT', value: 'google' },
      },
    },
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 1000,
  });

  return (response.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '';
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      date: formatted,
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
      users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    };
  });
}

export interface GoogleDailyByMediumRow {
  date: string;
  medium: string;
  sessions: number;
  users: number;
}

export async function fetchGoogleDailyByMediumSince(startDate: string): Promise<GoogleDailyByMediumRow[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = formatDate(yesterday);

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'EXACT', value: 'google' },
      },
    },
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 5000,
  });

  return (response.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '';
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      date: formatted,
      medium: row.dimensionValues?.[1]?.value ?? '(unknown)',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
      users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    };
  });
}

// ── Google Organic 深度分析 ──────────────────────────────────
const ORGANIC_FILTER = {
  andGroup: {
    expressions: [
      { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: 'google' } } },
      { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: 'organic' } } },
    ],
  },
};

export interface OrganicLandingPageRow {
  landingPage: string;
  sessions: number;
  users: number;
  newUsers: number;
}

export async function fetchOrganicLandingPages(startDate: string, endDate: string): Promise<OrganicLandingPageRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
    ],
    dimensionFilter: ORGANIC_FILTER,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    landingPage: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    newUsers: parseInt(row.metricValues?.[2]?.value ?? '0'),
  }));
}

export interface OrganicDeviceRow {
  device: string;
  sessions: number;
  users: number;
}

export async function fetchOrganicByDevice(startDate: string, endDate: string): Promise<OrganicDeviceRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    dimensionFilter: ORGANIC_FILTER,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  return (response.rows ?? []).map((row) => ({
    device: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    users: parseInt(row.metricValues?.[1]?.value ?? '0'),
  }));
}

export interface OrganicNewVsReturnRow {
  type: string;
  sessions: number;
  users: number;
}

export async function fetchOrganicNewVsReturn(startDate: string, endDate: string): Promise<OrganicNewVsReturnRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'newVsReturning' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    dimensionFilter: ORGANIC_FILTER,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  return (response.rows ?? []).map((row) => ({
    type: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
    users: parseInt(row.metricValues?.[1]?.value ?? '0'),
  }));
}

// ── 平台（Web / mWeb / App）────────────────────────────────
export interface PlatformRow {
  platform: 'Web' | 'mWeb' | 'App';
  sessions: number;
  users: number;
  newUsers: number;
}

export interface PlatformDailyRow {
  date: string;
  web: number;
  mweb: number;
  app: number;
}

function classifyPlatform(platform: string, device: string): 'Web' | 'mWeb' | 'App' {
  if (platform === 'web' || platform === 'Web') {
    return (device === 'desktop') ? 'Web' : 'mWeb';
  }
  return 'App';
}

async function fetchPlatformRawByDateRange(startDate: string, endDate: string) {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'platform' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  });

  const map = new Map<'Web' | 'mWeb' | 'App', PlatformRow>();
  for (const row of response.rows ?? []) {
    const key = classifyPlatform(
      row.dimensionValues?.[0]?.value ?? '',
      row.dimensionValues?.[1]?.value ?? ''
    );
    const existing = map.get(key) ?? { platform: key, sessions: 0, users: 0, newUsers: 0 };
    existing.sessions += parseInt(row.metricValues?.[0]?.value ?? '0');
    existing.users    += parseInt(row.metricValues?.[1]?.value ?? '0');
    existing.newUsers += parseInt(row.metricValues?.[2]?.value ?? '0');
    map.set(key, existing);
  }
  return (['Web', 'mWeb', 'App'] as const).map((k) => map.get(k) ?? { platform: k, sessions: 0, users: 0, newUsers: 0 });
}

export async function fetchPlatformReport(startDate: string, endDate: string): Promise<PlatformRow[]> {
  return fetchPlatformRawByDateRange(startDate, endDate);
}

export async function fetchPlatformDailySince(startDate: string): Promise<PlatformDailyRow[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = formatDate(yesterday);

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }, { name: 'platform' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 5000,
  });

  const dateMap = new Map<string, { web: number; mweb: number; app: number }>();
  for (const row of response.rows ?? []) {
    const raw  = row.dimensionValues?.[0]?.value ?? '';
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const key  = classifyPlatform(
      row.dimensionValues?.[1]?.value ?? '',
      row.dimensionValues?.[2]?.value ?? ''
    );
    const sessions = parseInt(row.metricValues?.[0]?.value ?? '0');
    const entry = dateMap.get(date) ?? { web: 0, mweb: 0, app: 0 };
    if (key === 'Web')  entry.web  += sessions;
    if (key === 'mWeb') entry.mweb += sessions;
    if (key === 'App')  entry.app  += sessions;
    dateMap.set(date, entry);
  }

  return [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

// ── 電子商務每日數據 ──────────────────────────────────────────
export interface EcommerceDailyRow {
  date: string;
  sessions: number;
  transactions: number;
  revenue: number;
  cvr: number;       // ecommercePurchaseRate (%)
  aov: number;       // averagePurchaseRevenue
  addToCarts: number;
}

export async function fetchEcommerceDailySince(startDate: string): Promise<EcommerceDailyRow[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = formatDate(yesterday);

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
      { name: 'addToCarts' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 1000,
  });

  return (response.rows ?? []).map((row) => {
    const raw      = row.dimensionValues?.[0]?.value ?? '';
    const date     = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const sessions     = parseInt(row.metricValues?.[0]?.value ?? '0');
    const transactions = parseInt(row.metricValues?.[1]?.value ?? '0');
    const revenue      = parseFloat(row.metricValues?.[2]?.value ?? '0');
    const addToCarts   = parseInt(row.metricValues?.[3]?.value ?? '0');
    return {
      date,
      sessions,
      transactions,
      revenue,
      cvr:        sessions > 0 ? (transactions / sessions) * 100 : 0,
      aov:        transactions > 0 ? revenue / transactions : 0,
      addToCarts,
    };
  });
}

export interface EcommerceRow {
  sessions: number;
  transactions: number;
  revenue: number;
  cvr: number;
  aov: number;
  addToCarts: number;
}

export async function fetchEcommerceReport(startDate: string, endDate: string): Promise<EcommerceRow> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
      { name: 'addToCarts' },
    ],
    limit: 1,
  });

  const row          = response.rows?.[0];
  const sessions     = parseInt(row?.metricValues?.[0]?.value ?? '0');
  const transactions = parseInt(row?.metricValues?.[1]?.value ?? '0');
  const revenue      = parseFloat(row?.metricValues?.[2]?.value ?? '0');
  const addToCarts   = parseInt(row?.metricValues?.[3]?.value ?? '0');
  return {
    sessions,
    transactions,
    revenue,
    cvr:      sessions > 0 ? (transactions / sessions) * 100 : 0,
    aov:      transactions > 0 ? revenue / transactions : 0,
    addToCarts,
  };
}

// ── 每小時流量（今日概況）────────────────────────────────────
export interface HourlyRow {
  hour: number;     // 0-23
  sessions: number;
  users: number;
  pageViews: number;
  newUsers: number;
}

export async function fetchHourlyTraffic(date: string): Promise<HourlyRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'hour' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'newUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'hour' }, desc: false }],
    limit: 24,
  });

  // 初始化 24 小時全為 0
  const result: HourlyRow[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i, sessions: 0, users: 0, pageViews: 0, newUsers: 0,
  }));
  for (const row of response.rows ?? []) {
    const h = parseInt(row.dimensionValues?.[0]?.value ?? '0');
    if (h >= 0 && h < 24) {
      result[h] = {
        hour:      h,
        sessions:  parseInt(row.metricValues?.[0]?.value ?? '0'),
        users:     parseInt(row.metricValues?.[1]?.value ?? '0'),
        pageViews: parseInt(row.metricValues?.[2]?.value ?? '0'),
        newUsers:  parseInt(row.metricValues?.[3]?.value ?? '0'),
      };
    }
  }
  return result;
}

// ── 月活躍用戶 MAU ───────────────────────────────────────────
export interface MonthlyUsersRow {
  users: number;
  newUsers: number;
}

export async function fetchMonthlyUsers(startDate: string, endDate: string): Promise<MonthlyUsersRow> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'newUsers' },
    ],
    limit: 1,
  });
  const row = response.rows?.[0];
  return {
    users:    parseInt(row?.metricValues?.[0]?.value ?? '0'),
    newUsers: parseInt(row?.metricValues?.[1]?.value ?? '0'),
  };
}

// ── 會員行為分析 ──────────────────────────────────────────────
export interface BehaviorOverviewRow {
  bounceRate: number;       // %
  engagementRate: number;   // %
  avgSessionDuration: number; // 秒
  pagesPerSession: number;
}

export async function fetchBehaviorOverview(startDate: string, endDate: string): Promise<BehaviorOverviewRow> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'bounceRate' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
    ],
    limit: 1,
  });
  const row = response.rows?.[0];
  return {
    bounceRate:          parseFloat(row?.metricValues?.[0]?.value ?? '0') * 100,
    engagementRate:      parseFloat(row?.metricValues?.[1]?.value ?? '0') * 100,
    avgSessionDuration:  parseFloat(row?.metricValues?.[2]?.value ?? '0'),
    pagesPerSession:     parseFloat(row?.metricValues?.[3]?.value ?? '0'),
  };
}

export interface FunnelRow {
  step: string;
  count: number;
}

export async function fetchFunnelData(startDate: string, endDate: string): Promise<FunnelRow[]> {
  // 正確漏斗做法：每個步驟取「有觸發該事件的工作階段數」
  // 這樣各步驟單位一致（工作階段），數字會單調遞減，轉換率才有意義
  const steps: { event: string; label: string }[] = [
    { event: 'session_start',  label: '工作階段' },
    { event: 'view_item',      label: '瀏覽商品' },
    { event: 'add_to_cart',    label: '加入購物車' },
    { event: 'begin_checkout', label: '開始結帳' },
    { event: 'purchase',       label: '完成購買' },
  ];

  // 平行查詢，每個步驟用 eventName filter + sessions metric
  const results = await Promise.all(
    steps.map(({ event }) =>
      analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: event },
          },
        },
        limit: 1,
      })
    )
  );

  return steps.map(({ label }, i) => {
    const count = parseInt(results[i][0].rows?.[0]?.metricValues?.[0]?.value ?? '0');
    return { step: label, count };
  });
}

// GA4 沒有 exits/exitRate 指標；改用高跳離率（bounceRate）+ 瀏覽量篩選
export interface ExitPageRow {
  pagePath: string;
  pageViews: number;
  bounceRate: number;  // %
  engagementRate: number; // %
}

export async function fetchTopExitPages(startDate: string, endDate: string): Promise<ExitPageRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'engagementRate' },
    ],
    orderBys: [{ metric: { metricName: 'bounceRate' }, desc: true }],
    limit: 30,
  });
  // 只取瀏覽量 >= 10 的頁面，避免低流量頁面造成的統計雜訊
  const rows = (response.rows ?? []).map((row) => ({
    pagePath:       row.dimensionValues?.[0]?.value ?? '',
    pageViews:      parseInt(row.metricValues?.[0]?.value ?? '0'),
    bounceRate:     parseFloat(row.metricValues?.[1]?.value ?? '0') * 100,
    engagementRate: parseFloat(row.metricValues?.[2]?.value ?? '0') * 100,
  })).filter((r) => r.pageViews >= 10);
  return rows.slice(0, 15);
}

export interface TopPageRow {
  pagePath: string;
  pageViews: number;
  avgDuration: number; // 秒
  bounceRate: number;  // %
}

export async function fetchTopPagesByEngagement(startDate: string, endDate: string): Promise<TopPageRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'userEngagementDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 15,
  });
  return (response.rows ?? []).map((row) => {
    const views = parseInt(row.metricValues?.[0]?.value ?? '0');
    const dur   = parseFloat(row.metricValues?.[1]?.value ?? '0');
    return {
      pagePath:    row.dimensionValues?.[0]?.value ?? '',
      pageViews:   views,
      avgDuration: views > 0 ? dur / views : 0,
      bounceRate:  parseFloat(row.metricValues?.[2]?.value ?? '0') * 100,
    };
  });
}

export interface DailyTotalRow {
  date: string;
  users: number;
}

// ── 渠道每月趨勢 ─────────────────────────────────────────────
export interface ChannelMonthlyRow {
  yearMonth: string;   // "2026-01"
  channel: string;
  users: number;
  sessions: number;
  newUsers: number;
}

export async function fetchChannelMonthlyTrend(startDate: string, endDate: string): Promise<ChannelMonthlyRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'sessionDefaultChannelGrouping' },
    ],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'newUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'yearMonth' }, desc: false }],
    limit: 500,
  });

  return (response.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '';
    return {
      yearMonth: `${raw.slice(0, 4)}-${raw.slice(4, 6)}`,
      channel:   row.dimensionValues?.[1]?.value ?? '(unknown)',
      users:     parseInt(row.metricValues?.[0]?.value ?? '0'),
      sessions:  parseInt(row.metricValues?.[1]?.value ?? '0'),
      newUsers:  parseInt(row.metricValues?.[2]?.value ?? '0'),
    };
  });
}

// ── Google 各媒介 CVR 分析 ───────────────────────────────────
export interface GoogleEcomRow {
  medium: string;
  sessions: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
  cvr: number;   // %
  aov: number;
}

export async function fetchGoogleEcommerce(startDate: string, endDate: string): Promise<GoogleEcomRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'addToCarts' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'EXACT', value: 'google' },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => {
    const sessions   = parseInt(row.metricValues?.[0]?.value ?? '0');
    const addToCarts = parseInt(row.metricValues?.[1]?.value ?? '0');
    const purchases  = parseInt(row.metricValues?.[2]?.value ?? '0');
    const revenue    = parseFloat(row.metricValues?.[3]?.value ?? '0');
    return {
      medium:     row.dimensionValues?.[0]?.value ?? '(unknown)',
      sessions,
      addToCarts,
      purchases,
      revenue,
      cvr: sessions > 0 ? (purchases / sessions) * 100 : 0,
      aov: purchases > 0 ? revenue / purchases : 0,
    };
  });
}

// ── 商品分類 × 渠道分析 ──────────────────────────────────────
export interface CategoryChannelRow {
  channel: string;
  users: number;
  sessions: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
}

export async function fetchChannelByItemCategory(
  category: string,
  startDate: string,
  endDate: string,
): Promise<CategoryChannelRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'addToCarts' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'itemCategory',
        stringFilter: { matchType: 'EXACT', value: category },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    channel:    row.dimensionValues?.[0]?.value ?? '(unknown)',
    users:      parseInt(row.metricValues?.[0]?.value ?? '0'),
    sessions:   parseInt(row.metricValues?.[1]?.value ?? '0'),
    addToCarts: parseInt(row.metricValues?.[2]?.value ?? '0'),
    purchases:  parseInt(row.metricValues?.[3]?.value ?? '0'),
    revenue:    parseFloat(row.metricValues?.[4]?.value ?? '0'),
  }));
}

// ── 渠道用戶分布（Channel Grouping）────────────────────────────
export interface ChannelRow {
  channel: string;
  users: number;
  sessions: number;
  newUsers: number;
}

export async function fetchChannelUsers(startDate: string, endDate: string): Promise<ChannelRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'newUsers' },
    ],
    orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    channel:  row.dimensionValues?.[0]?.value ?? '(unknown)',
    users:    parseInt(row.metricValues?.[0]?.value ?? '0'),
    sessions: parseInt(row.metricValues?.[1]?.value ?? '0'),
    newUsers: parseInt(row.metricValues?.[2]?.value ?? '0'),
  }));
}

export async function fetchDailyTotalsSince(startDate: string): Promise<DailyTotalRow[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = formatDate(yesterday);

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'totalUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: 1000,
  });

  return (response.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? '';
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      date: formatted,
      users: parseInt(row.metricValues?.[0]?.value ?? '0'),
    };
  });
}

// ── 版位促銷點擊 ─────────────────────────────────────────────
export interface PromotionClickRow {
  promotionId:   string;
  promotionName: string;
  creativeName:  string;
  creativeSlot:  string;
  clicks:        number;
}

export async function fetchPromotionClicks(startDate: string, endDate: string): Promise<PromotionClickRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'customEvent:promotion_id' },
      { name: 'customEvent:promotion_name' },
      { name: 'customEvent:creative_name' },
      { name: 'customEvent:creative_slot' },
    ],
    metrics: [{ name: 'promotionClicks' }],
    orderBys: [{ metric: { metricName: 'promotionClicks' }, desc: true }],
    limit: 500,
  });

  return (response.rows ?? []).map((row) => ({
    promotionId:   row.dimensionValues?.[0]?.value ?? '',
    promotionName: row.dimensionValues?.[1]?.value ?? '',
    creativeName:  row.dimensionValues?.[2]?.value ?? '',
    creativeSlot:  row.dimensionValues?.[3]?.value ?? '',
    clicks:        parseInt(row.metricValues?.[0]?.value ?? '0'),
  }));
}

// ── AI 流量 ──────────────────────────────────────────────────────
export const AI_SOURCES = [
  'chat.openai.com',
  'chatgpt.com',
  'perplexity.ai',
  'copilot.microsoft.com',
  'gemini.google.com',
  'claude.ai',
  'you.com',
  'phind.com',
  'poe.com',
  'bing.com',        // Copilot 有時走 bing
];

export interface AiTrafficRow {
  yearMonth: string;
  source:    string;
  sessions:  number;
  users:     number;
  newUsers:  number;
  purchases: number;
  revenue:   number;
}

export async function fetchAiTraffic(startDate: string, endDate: string): Promise<AiTrafficRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'sessionSource' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: { values: AI_SOURCES, caseSensitive: false },
      },
    },
    orderBys: [
      { dimension: { dimensionName: 'yearMonth' } },
      { metric: { metricName: 'sessions' }, desc: true },
    ],
    limit: 2000,
  });

  return (response.rows ?? []).map((row) => ({
    yearMonth: row.dimensionValues?.[0]?.value ?? '',
    source:    row.dimensionValues?.[1]?.value ?? '',
    sessions:  parseInt(row.metricValues?.[0]?.value ?? '0'),
    users:     parseInt(row.metricValues?.[1]?.value ?? '0'),
    newUsers:  parseInt(row.metricValues?.[2]?.value ?? '0'),
    purchases: parseInt(row.metricValues?.[3]?.value ?? '0'),
    revenue:   parseFloat(row.metricValues?.[4]?.value ?? '0'),
  }));
}

export interface AiLandingRow {
  source:      string;
  landingPage: string;
  sessions:    number;
  users:       number;
  purchases:   number;
  revenue:     number;
}

export async function fetchAiLandingPages(startDate: string, endDate: string): Promise<AiLandingRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'landingPage' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: { values: AI_SOURCES, caseSensitive: false },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 1000,
  });

  return (response.rows ?? []).map((row) => ({
    source:      row.dimensionValues?.[0]?.value ?? '',
    landingPage: row.dimensionValues?.[1]?.value ?? '',
    sessions:    parseInt(row.metricValues?.[0]?.value ?? '0'),
    users:       parseInt(row.metricValues?.[1]?.value ?? '0'),
    purchases:   parseInt(row.metricValues?.[2]?.value ?? '0'),
    revenue:     parseFloat(row.metricValues?.[3]?.value ?? '0'),
  }));
}

// ── 站內搜尋字詞 ──────────────────────────────────────────────────

export interface SearchTermRow {
  term:    string;
  count:   number;
  users:   number;
}

const SEARCH_NOISE = new Set(['App', 'MWeb', 'app', 'mweb', '', '(not set)']);

export async function fetchSiteSearch(startDate: string, endDate: string): Promise<SearchTermRow[]> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'searchTerm' }],
    metrics:    [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'search' } },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 150,
  });

  return (response.rows ?? [])
    .map((row) => ({
      term:  row.dimensionValues?.[0]?.value ?? '',
      count: parseInt(row.metricValues?.[0]?.value ?? '0'),
      users: parseInt(row.metricValues?.[1]?.value ?? '0'),
    }))
    .filter((r) => r.term && !SEARCH_NOISE.has(r.term) && r.count > 0)
    .slice(0, 100);
}
