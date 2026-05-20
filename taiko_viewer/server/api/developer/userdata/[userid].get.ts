import { getDeveloperUserdataByUserid } from "~/server/utils/account";

export default defineEventHandler(async (event) => getDeveloperUserdataByUserid(event, event.context.params?.userid));
