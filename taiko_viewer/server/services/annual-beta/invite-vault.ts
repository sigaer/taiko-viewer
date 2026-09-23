import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { hashBetaToken, normalizeInvite } from './core.ts';

// Provisioned outside Git; never search temporary directories or accept a client path.
export const INVITE_VAULT = '/var/lib/taiko/annual-beta/invites.csv';
export async function readInviteVault(path = INVITE_VAULT) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o077) || stat.size > 128 * 1024) throw new Error('Invalid invite vault');
    const rows = (await file.readFile('utf8')).trim().split(/\r?\n/);
    if (rows.shift() !== 'code,cohort,expires_at' || rows.length > 1000) throw new Error('Invalid invite vault');
    const codes = new Map<string, { code: string; cohort: string }>();
    for (const row of rows) {
      const [raw, cohort, expiry, extra] = row.split(',');
      if (!['wave1', 'wave2'].includes(cohort) || !Number.isFinite(Date.parse(expiry)) || extra !== undefined) throw new Error('Invalid invite vault');
      const code = normalizeInvite(raw);
      codes.set(hashBetaToken(code), { code, cohort });
    }
    return codes;
  } finally { await file.close(); }
}

export function availableInviteCodes(rows: any[], vault: Map<string, { code: string; cohort: string }>, now = Date.now()) {
  return rows.flatMap(row => {
    const stored = vault.get(row.code_hash);
    if (!stored || stored.cohort !== row.cohort || row.analysis_excluded || row.disabled_at || Number(row.used_count) >= Math.min(1, Number(row.max_uses)) || new Date(row.expires_at).getTime() <= now) return [];
    return [{ id: row.id, code: stored.code, cohort: row.cohort, expires_at: row.expires_at }];
  });
}
