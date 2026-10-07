/**
 * GA4 Promotion 事件盤點
 * 執行：npx tsx src/inventoryPromotion.ts
 */
import fs from 'fs';
import path from 'path';
import { analyticsDataClient, PROPERTY_ID } from './ga4Client.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchPromotionData(startDate: string, endDate: string) {
  const DIMS = [
    { name: 'customEvent:promotion_id' },
    { name: 'customEvent:promotion_name' },
    { name: 'customEvent:creative_slot' },
    { name: 'customEvent:creative_name' },
  ];

  const [viewRes, clickRes] = await Promise.all([
    analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: DIMS,
      metrics: [{ name: 'promotionViews' }],
      orderBys: [{ metric: { metricName: 'promotionViews' }, desc: true }],
      limit: 500,
    }),
    analyticsDataClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: DIMS,
      metrics: [{ name: 'promotionClicks' }],
      orderBys: [{ metric: { metricName: 'promotionClicks' }, desc: true }],
      limit: 500,
    }),
  ]);

  const parse = (rows: any[], metricIdx = 0) =>
    (rows ?? []).map((r: any) => ({
      promotionId:   r.dimensionValues?.[0]?.value ?? '',
      promotionName: r.dimensionValues?.[1]?.value ?? '',
      creativeSlot:  r.dimensionValues?.[2]?.value ?? '',
      creativeName:  r.dimensionValues?.[3]?.value ?? '',
      count:         parseInt(r.metricValues?.[metricIdx]?.value ?? '0'),
    }));

  return {
    views:  parse(viewRes[0].rows  ?? []),
    clicks: parse(clickRes[0].rows ?? []),
  };
}

function pad(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); }
function fmt(n: number) { return n.toLocaleString().padStart(10); }

async function main() {
  const END   = 'yesterday';
  const START = '30daysAgo';
  const START_LABEL = '近30天';

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   ETMALL GA4 Promotion 追蹤盤點（${START_LABEL}）              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  console.log('正在抓取資料...\n');

  const { views, clicks } = await fetchPromotionData(START, END);

  // 合併成 key → { views, clicks }
  const map = new Map<string, {
    promotionId: string; promotionName: string;
    creativeSlot: string; creativeName: string;
    views: number; clicks: number;
  }>();

  const key = (r: { promotionId: string; creativeSlot: string; creativeName: string }) =>
    `${r.promotionId}||${r.creativeSlot}||${r.creativeName}`;

  views.forEach((r) => {
    const k = key(r);
    map.set(k, { ...r, views: r.count, clicks: 0 });
  });
  clicks.forEach((r) => {
    const k = key(r);
    const cur = map.get(k);
    if (cur) cur.clicks = r.count;
    else map.set(k, { ...r, views: 0, clicks: r.count });
  });

  const rows = [...map.values()].sort((a, b) => b.views - a.views);

  // ── 依 creativeSlot 分組輸出 ──
  const bySlot = new Map<string, typeof rows>();
  rows.forEach((r) => {
    const slot = r.creativeSlot || '(未設定 slot)';
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot)!.push(r);
  });

  // 統計
  const totalSlots  = bySlot.size;
  const totalItems  = rows.length;
  const noSlot      = rows.filter((r) => !r.creativeSlot || r.creativeSlot === '(not set)').length;
  const noId        = rows.filter((r) => !r.promotionId  || r.promotionId  === '(not set)').length;
  const noClick     = rows.filter((r) => r.clicks === 0).length;
  const totalViews  = rows.reduce((s, r) => s + r.views, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);

  console.log(`【摘要】`);
  console.log(`  版位（creativeSlot）數量：${totalSlots}`);
  console.log(`  Promotion 項目總數：${totalItems}`);
  console.log(`  總 view_promotion：${totalViews.toLocaleString()}`);
  console.log(`  總 select_promotion：${totalClicks.toLocaleString()}`);
  console.log(`  整體 CTR：${totalViews > 0 ? (totalClicks / totalViews * 100).toFixed(2) : '0'}%`);
  console.log(`  ⚠ 未設 creativeSlot：${noSlot} 筆`);
  console.log(`  ⚠ 未設 promotionId：${noId} 筆`);
  console.log(`  ⚠ 有曝光但零點擊：${noClick} 筆\n`);

  // ── 各版位明細 ──
  for (const [slot, items] of bySlot.entries()) {
    const slotViews  = items.reduce((s, r) => s + r.views, 0);
    const slotClicks = items.reduce((s, r) => s + r.clicks, 0);
    const slotCtr    = slotViews > 0 ? (slotClicks / slotViews * 100).toFixed(2) : '0.00';
    console.log(`\n▌ 版位：${slot}  （${items.length} 個 promotion，曝光 ${slotViews.toLocaleString()}，點擊 ${slotClicks.toLocaleString()}，CTR ${slotCtr}%）`);
    console.log(`  ${pad('promotionId', 30)} ${pad('promotionName', 30)} ${pad('creativeName', 30)} ${'曝光'.padStart(10)} ${'點擊'.padStart(8)} ${'CTR%'.padStart(7)}`);
    console.log('  ' + '─'.repeat(100));
    items.sort((a, b) => b.views - a.views).forEach((r) => {
      const ctr = r.views > 0 ? (r.clicks / r.views * 100).toFixed(2) : '—';
      console.log(
        `  ${pad(r.promotionId || '—', 30)} ${pad(r.promotionName || '—', 30)} ${pad(r.creativeName || '—', 30)}` +
        ` ${fmt(r.views)} ${String(r.clicks.toLocaleString()).padStart(8)} ${ctr.padStart(7)}%`
      );
    });
  }

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  // ── 完整清單 CSV ──
  const allCsv = [
    'creativeSlot,promotionId,promotionName,creativeName,view_promotion,select_promotion,CTR%,異常類型',
    ...rows.map((r) => {
      const ctr      = r.views > 0 ? (r.clicks / r.views * 100).toFixed(2) : '—';
      const slot     = r.creativeSlot || '(not set)';
      const flags: string[] = [];
      if (!r.creativeSlot || r.creativeSlot === '(not set)') flags.push('缺slot');
      if (r.views > 1000 && r.clicks === 0)                  flags.push('高曝光零點擊');
      if (r.clicks > 0 && r.views === 0)                     flags.push('有點擊無曝光');
      return [esc(slot), esc(r.promotionId), esc(r.promotionName), esc(r.creativeName), r.views, r.clicks, ctr, esc(flags.join('|'))].join(',');
    }),
  ].join('\n');

  const allCsvPath = path.join(__dirname, '..', 'reports', 'promotion-inventory.csv');
  fs.writeFileSync(allCsvPath, '﻿' + allCsv, 'utf-8');
  console.log(`\n✅ 完整清單：reports/promotion-inventory.csv（共 ${rows.length} 筆）`);

  // ── 異常清單 CSV ──
  const anomalies = rows.filter((r) => {
    const noSlot        = !r.creativeSlot || r.creativeSlot === '(not set)';
    const highViewNoClick = r.views > 1000 && r.clicks === 0;
    const clickNoView   = r.clicks > 0 && r.views === 0;
    return noSlot || highViewNoClick || clickNoView;
  });

  // 分類標籤
  const classify = (r: typeof rows[0]): string => {
    const tags: string[] = [];
    if (!r.creativeSlot || r.creativeSlot === '(not set)') tags.push('❶ 缺 creative_slot 參數');
    if (r.views > 1000 && r.clicks === 0)                  tags.push('❷ 高曝光但零點擊');
    if (r.clicks > 0 && r.views === 0)                     tags.push('❸ 有點擊無曝光');
    return tags.join(' + ');
  };

  const anomalyCsv = [
    '異常類型,creativeSlot,promotionId,promotionName,creativeName,view_promotion,select_promotion,CTR%',
    ...anomalies
      .sort((a, b) => b.views - a.views)
      .map((r) => {
        const ctr  = r.views > 0 ? (r.clicks / r.views * 100).toFixed(2) : '—';
        const slot = r.creativeSlot || '(not set)';
        return [esc(classify(r)), esc(slot), esc(r.promotionId), esc(r.promotionName), esc(r.creativeName), r.views, r.clicks, ctr].join(',');
      }),
  ].join('\n');

  const anomalyPath = path.join(__dirname, '..', 'reports', 'promotion-anomalies.csv');
  fs.writeFileSync(anomalyPath, '﻿' + anomalyCsv, 'utf-8');
  console.log(`✅ 異常清單：reports/promotion-anomalies.csv（共 ${anomalies.length} 筆）\n`);

  // ── 終端機快覽異常 ──
  console.log(`【異常清單快覽】`);
  console.log(`\n  ❶ 缺 creative_slot 參數（有曝光但 slot 是 (not set)）`);
  const noSlotRows = anomalies.filter((r) => !r.creativeSlot || r.creativeSlot === '(not set)').sort((a, b) => b.views - a.views);
  console.log(`  ${'promotionId'.padEnd(35)} ${'promotionName'.padEnd(25)} ${'曝光'.padStart(10)} ${'點擊'.padStart(8)}`);
  console.log('  ' + '─'.repeat(82));
  noSlotRows.forEach((r) => {
    console.log(`  ${pad(r.promotionId, 35)} ${pad(r.promotionName, 25)} ${fmt(r.views)} ${String(r.clicks.toLocaleString()).padStart(8)}`);
  });

  console.log(`\n  ❷ 高曝光但零點擊（>1000 曝光，0 點擊，slot 非 EMPTY）`);
  const highViewNoClick = anomalies
    .filter((r) => r.views > 1000 && r.clicks === 0 && r.creativeSlot && r.creativeSlot !== '(not set)' && r.creativeSlot !== 'EMPTY')
    .sort((a, b) => b.views - a.views);
  if (highViewNoClick.length === 0) {
    console.log('  （無）');
  } else {
    console.log(`  ${'creativeSlot'.padEnd(25)} ${'promotionId'.padEnd(30)} ${'promotionName'.padEnd(25)} ${'曝光'.padStart(10)}`);
    console.log('  ' + '─'.repeat(94));
    highViewNoClick.forEach((r) => {
      console.log(`  ${pad(r.creativeSlot, 25)} ${pad(r.promotionId, 30)} ${pad(r.promotionName, 25)} ${fmt(r.views)}`);
    });
  }

  console.log(`\n  ❸ 有點擊無曝光（可能是 view_promotion 未設定）`);
  const clickNoView = anomalies.filter((r) => r.clicks > 0 && r.views === 0).sort((a, b) => b.clicks - a.clicks);
  if (clickNoView.length === 0) {
    console.log('  （無）');
  } else {
    console.log(`  ${'creativeSlot'.padEnd(25)} ${'promotionId'.padEnd(30)} ${'promotionName'.padEnd(25)} ${'點擊'.padStart(10)}`);
    console.log('  ' + '─'.repeat(94));
    clickNoView.forEach((r) => {
      console.log(`  ${pad(r.creativeSlot, 25)} ${pad(r.promotionId, 30)} ${pad(r.promotionName, 25)} ${fmt(r.clicks)}`);
    });
  }
  console.log();
}

main().catch(console.error);
