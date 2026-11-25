import { readBody, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { evaluatePortfolio } from '~/server/services/goals/portfolio-evaluation';
export default defineEventHandler(async (event) => {
    setHeader(event, 'Cache-Control', 'private, no-store');
    setHeader(event, 'Vary', 'Cookie');
    const user = await requireAccountUser(event);
    return evaluatePortfolio(user.id, await readBody(event));
});
