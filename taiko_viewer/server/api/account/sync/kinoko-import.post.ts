import { readBody } from "h3";
import { importKinokoScores } from "~/server/utils/account";

export default defineEventHandler(async (event) => importKinokoScores(event, await readBody(event)));
