import { readBody } from "h3";
import { importKinokoScoreHistory } from "~/server/utils/account";

export default defineEventHandler(async (event) => importKinokoScoreHistory(event, await readBody(event)));
