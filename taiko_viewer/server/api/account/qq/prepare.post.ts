import { readBody } from "h3";
import { requireAccountUser, startQqBinding } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
    const user = await requireAccountUser(event);
    const body = await readBody(event);
    const result = await startQqBinding(user.id, body?.qqNumber);
    return { ok: true, ...result };
});