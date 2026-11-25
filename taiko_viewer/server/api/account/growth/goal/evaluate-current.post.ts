import { getAccountDb } from '~/server/utils/account-db';
import { rejectLegacyGoalWrite } from '~/server/services/goals/portfolio-schema';
import { readBody, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { evaluateCurrentGoalForBinding } from '~/server/services/goals/evaluation';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  setHeader(event, 'Vary', 'Cookie');
  const user = await requireAccountUser(event);
  await rejectLegacyGoalWrite(getAccountDb());
  return evaluateCurrentGoalForBinding(user.id, await readBody(event));
});
