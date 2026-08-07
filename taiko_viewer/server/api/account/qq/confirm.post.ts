import { readBody } from "h3";
import { requireAccountUser, confirmQqBinding } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
    const user = await requireAccountUser(event);
    const body = await readBody(event);
    const result = await confirmQqBinding(user.id, body?.code);
    return { ok: true, ...result };
});