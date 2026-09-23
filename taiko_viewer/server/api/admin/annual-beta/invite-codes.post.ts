import { createError, readBody, setHeader } from 'h3';
import { requireBetaAdmin } from '~/server/services/annual-beta/admin';
import { assertBetaOrigin } from '~/server/services/annual-beta/events';
import { availableInviteCodes, readInviteVault } from '~/server/services/annual-beta/invite-vault';
import { getAccountDb } from '~/server/utils/account-db';
import { recordAdminAction } from '~/server/utils/admin/audit';

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  const session = await requireBetaAdmin(event);
  assertBetaOrigin(event);
  const body = await readBody(event);
  if (!['wave1', 'wave2'].includes(body?.cohort)) throw createError({ statusCode: 400, statusMessage: '请选择邀请批次' });
  let vault;
  try { vault = await readInviteVault(); }
  catch { throw createError({ statusCode: 503, statusMessage: '邀请码原件暂不可用，请联系维护人员' }); }
  const [rows]: any = await getAccountDb().execute(`SELECT id,code_hash,cohort,expires_at,used_count,max_uses,disabled_at,analysis_excluded
    FROM web_beta_invites WHERE cohort=? AND analysis_excluded=0 AND disabled_at IS NULL
    AND used_count=0 AND max_uses>0 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1000`, [body.cohort]);
  const invites = availableInviteCodes(rows, vault);
  await recordAdminAction({ actorType: 'admin', actorId: String(session.user.id), actorName: session.user.username,
    source: 'admin-web', targetType: 'annual-beta', targetKey: body.cohort, action: 'read',
    extra: { action: 'view_invite_codes', count: invites.length } });
  return { invites, unavailable: rows.length - invites.length };
});
