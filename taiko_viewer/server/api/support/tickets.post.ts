import { readBody } from "h3";
import { createSupportTicket } from "~/server/utils/support";

export default defineEventHandler(async (event) =>
  createSupportTicket(event, await readBody<Record<string, unknown>>(event))
);
