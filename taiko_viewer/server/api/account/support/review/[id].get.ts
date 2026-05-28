import { getSupportReviewTicketDetail } from "~/server/utils/support";

export default defineEventHandler((event) => getSupportReviewTicketDetail(event, event.context.params?.id));
