import { readBody } from "h3";
import { reviewDeveloperApplication } from "~/server/utils/account";

export default defineEventHandler(async (event) => reviewDeveloperApplication(event, await readBody(event)));
