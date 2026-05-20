import { getDeveloperReviewDashboard } from "~/server/utils/account";

export default defineEventHandler(async (event) => getDeveloperReviewDashboard(event));
