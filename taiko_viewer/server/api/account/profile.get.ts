import { getProfileResponse } from "~/server/utils/account";

export default defineEventHandler(async (event) => getProfileResponse(event));
