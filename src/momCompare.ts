import { SessionSourceRow } from './fetchReport.js';

export interface MomRow {
  sessionSource: string;
  current: { sessions: number; users: number; newUsers: number };
  previous: { sessions: number; users: number; newUsers: number };
  mom: { sessions: number; users: number; newUsers: number };
}

function calcMom(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

export function compareMom(
  current: SessionSourceRow[],
  previous: SessionSourceRow[]
): MomRow[] {
  const prevMap = new Map(previous.map((r) => [r.sessionSource, r]));

  const allSources = new Set([
    ...current.map((r) => r.sessionSource),
    ...previous.map((r) => r.sessionSource),
  ]);

  const rows: MomRow[] = [];

  for (const source of allSources) {
    const cur = current.find((r) => r.sessionSource === source) ?? {
      sessionSource: source,
      sessions: 0,
      users: 0,
      newUsers: 0,
    };
    const prev = prevMap.get(source) ?? {
      sessionSource: source,
      sessions: 0,
      users: 0,
      newUsers: 0,
    };

    rows.push({
      sessionSource: source,
      current: { sessions: cur.sessions, users: cur.users, newUsers: cur.newUsers },
      previous: { sessions: prev.sessions, users: prev.users, newUsers: prev.newUsers },
      mom: {
        sessions: calcMom(cur.sessions, prev.sessions),
        users: calcMom(cur.users, prev.users),
        newUsers: calcMom(cur.newUsers, prev.newUsers),
      },
    });
  }

  return rows.sort((a, b) => b.current.sessions - a.current.sessions);
}

export function formatMomTable(rows: MomRow[], title: string): string {
  const lines = [`## ${title}`, ''];
  lines.push('| 來源 | 當期工作階段 | 前期工作階段 | MOM% | 當期用戶 | MOM% |');
  lines.push('|------|------------|------------|------|--------|------|');

  for (const row of rows) {
    const sessionMom = row.mom.sessions >= 0 ? `+${row.mom.sessions}%` : `${row.mom.sessions}%`;
    const userMom = row.mom.users >= 0 ? `+${row.mom.users}%` : `${row.mom.users}%`;
    lines.push(
      `| ${row.sessionSource} | ${row.current.sessions} | ${row.previous.sessions} | ${sessionMom} | ${row.current.users} | ${userMom} |`
    );
  }

  return lines.join('\n');
}
