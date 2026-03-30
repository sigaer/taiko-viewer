import { readBody } from "h3";
import { submitAccountSync } from "~/server/utils/account";

export default defineEventHandler(async (event) => submitAccountSync(event, await readBody(event)));
