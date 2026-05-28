import { readBody } from "h3";
import { addSupportTicketMessage } from "~/server/utils/support";

export default defineEventHandler(async (event) =>
  addSupportTicketMessage(event, event.context.params?.id, await readBody<Record<string, unknown>>(event))
);
