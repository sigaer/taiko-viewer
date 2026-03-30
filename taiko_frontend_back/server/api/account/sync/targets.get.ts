import { getAccountSyncOverview } from "~/server/utils/account";

export default defineEventHandler(async (event) => getAccountSyncOverview(event));
