import { requireAccountUser, removeQqBinding } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
    const user = await requireAccountUser(event);
    const result = await removeQqBinding(user.id);
    return { ok: true, ...result };
});