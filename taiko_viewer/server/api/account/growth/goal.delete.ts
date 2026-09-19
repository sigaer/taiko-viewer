import { readBody, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { writePlayerGoal } from '~/server/services/goals/service';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  setHeader(event, 'Vary', 'Cookie');
  const user = await requireAccountUser(event);
  return writePlayerGoal(user.id, await readBody(event), true);
});
