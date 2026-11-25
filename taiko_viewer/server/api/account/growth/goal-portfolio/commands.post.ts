import { readBody, setHeader } from 'h3';
import { requireAccountUser } from '~/server/utils/account';
import { commandPortfolio } from '~/server/services/goals/portfolio-service';
export default defineEventHandler(async (event) => {
    setHeader(event, 'Cache-Control', 'private, no-store');
    setHeader(event, 'Vary', 'Cookie');
    const user = await requireAccountUser(event);
    return commandPortfolio(user.id, await readBody(event));
});
