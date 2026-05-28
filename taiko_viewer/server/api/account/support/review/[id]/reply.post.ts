import { readBody } from "h3";
import { replySupportTicketAsStaff } from "~/server/utils/support";

export default defineEventHandler(async (event) =>
  replySupportTicketAsStaff(event, event.context.params?.id, await readBody<Record<string, unknown>>(event))
);
