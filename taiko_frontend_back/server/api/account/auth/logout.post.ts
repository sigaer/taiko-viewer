import { logoutAccount } from "~/server/utils/account";

export default defineEventHandler(async (event) => logoutAccount(event));
