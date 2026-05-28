import { closeSupportTicketAsStaff } from "~/server/utils/support";

export default defineEventHandler((event) => closeSupportTicketAsStaff(event, event.context.params?.id));
