import { createError, readBody, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { previewRecommendationGoal } from '~/server/services/goals/recommendation';
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','private, no-store'); setHeader(event,'Vary','Cookie');
  const user = await requireAccountUser(event), body = await readBody(event);
  if (!body || Object.keys(body).some(k=>k!=='recommendationToken')) throw createError({statusCode:400,statusMessage:'invalid-goal-request'});
  return previewRecommendationGoal(user.id,body.recommendationToken);
});
