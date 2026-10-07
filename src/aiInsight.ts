import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { MomRow } from './momCompare.js';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateInsight(
  dateLabel: string,
  dailyRows: MomRow[],
  monthlyRows: MomRow[]
): Promise<string> {
  const dailySummary = dailyRows
    .slice(0, 10)
    .map(
      (r) =>
        `來源: ${r.sessionSource} | 工作階段: ${r.current.sessions}（MOM ${r.mom.sessions > 0 ? '+' : ''}${r.mom.sessions}%）| 用戶: ${r.current.users}（MOM ${r.mom.users > 0 ? '+' : ''}${r.mom.users}%）`
    )
    .join('\n');

  const monthlySummary = monthlyRows
    .slice(0, 10)
    .map(
      (r) =>
        `來源: ${r.sessionSource} | 工作階段: ${r.current.sessions}（MOM ${r.mom.sessions > 0 ? '+' : ''}${r.mom.sessions}%）| 用戶: ${r.current.users}（MOM ${r.mom.users > 0 ? '+' : ''}${r.mom.users}%）`
    )
    .join('\n');

  const prompt = `你是一位專業的數位行銷分析師，請根據以下 GA4 流量資料，用繁體中文撰寫分析報告。

**分析日期：** ${dateLabel}

---
### 每日資料（昨天 vs 上個月同一天）
${dailySummary}

---
### 月累計資料（本月截至昨天 vs 上月同期）
${monthlySummary}

---
請依以下結構輸出分析報告：

1. **整體流量摘要** - 昨日整體表現與月趨勢簡述
2. **主要來源分析** - 前三大流量來源的表現與 MOM 變化解讀
3. **值得關注的異常** - 有明顯上升或下降的來源（MOM > ±20%）
4. **行動建議** - 2-3 項具體建議

請保持分析客觀、具體，避免空洞的描述。`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text ?? '（AI 分析無回應）';
}
