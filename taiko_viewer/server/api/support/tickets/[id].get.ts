import { getSupportTicketDetail } from "~/server/utils/support";

export default defineEventHandler((event) => getSupportTicketDetail(event, event.context.params?.id));
