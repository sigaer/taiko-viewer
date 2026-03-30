import { readDeveloperApplicationMultipart } from "~/server/internal/account/developer";
import { submitDeveloperApplication } from "~/server/utils/account";

export default defineEventHandler(async (event) => submitDeveloperApplication(event, await readDeveloperApplicationMultipart(event)));
