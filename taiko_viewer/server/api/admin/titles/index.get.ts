import { getQuery } from 'h3';
import { requireTaikoAdminSession } from '~/server/utils/admin/auth';
import { titleConditionManager } from '~/server/utils/admin/title-conditions';

export default defineEventHandler(async event => {
  const session = await requireTaikoAdminSession(event);
  return titleConditionManager(session.token).list(getQuery(event));
});
