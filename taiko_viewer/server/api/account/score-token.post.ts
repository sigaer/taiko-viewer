import { readBody } from "h3";
import { manageAccountScoreToken } from "~/server/utils/account";

export default defineEventHandler(async (event) => manageAccountScoreToken(event, await readBody(event)));
