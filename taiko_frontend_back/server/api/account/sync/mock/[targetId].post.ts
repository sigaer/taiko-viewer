import { receiveMockSyncPayload } from "~/server/internal/account/sync";

export default defineEventHandler(async (event) => receiveMockSyncPayload(event, event.context.params?.targetId));
