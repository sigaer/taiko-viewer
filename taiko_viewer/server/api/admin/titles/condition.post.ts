import { createError, getRequestURL, getHeader, readBody } from 'h3';
import { requireTaikoAdminSession } from '~/server/utils/admin/auth';
import { titleConditionManager } from '~/server/utils/admin/title-conditions';

export default defineEventHandler(async event => {
  const session = await requireTaikoAdminSession(event);
  const origin = getHeader(event, 'origin');
  if (origin && origin !== getRequestURL(event).origin) throw createError({ statusCode: 403, statusMessage: '请求来源无效' });
  return titleConditionManager(session.token).save(session.user, (await readBody(event)) || {});
});
