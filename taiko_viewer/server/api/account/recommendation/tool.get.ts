import { getQuery, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { getRecommendationTool } from '~/server/services/account/recommendation-tool';
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','private, no-store'); setHeader(event,'Vary','Cookie');
  const user = await requireAccountUser(event), query = getQuery(event);
  return getRecommendationTool(user.id,{n:Number(query.n),dim:typeof query.dim==='string'?query.dim:undefined,image:query.image==='true'});
});
