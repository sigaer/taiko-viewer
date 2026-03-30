import { getDeveloperApplicationStatus } from "~/server/utils/account";

export default defineEventHandler(async (event) => getDeveloperApplicationStatus(event));
