import { listSupportTickets } from "~/server/utils/support";

export default defineEventHandler((event) => listSupportTickets(event));
