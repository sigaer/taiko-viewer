import { handleInboundExternal } from "~/server/services/oidc/inbound-external";

// SAKURA-PROTOCOL 0.1 §4: exact protocol path (not /api/internal/...)
export default defineEventHandler(event => handleInboundExternal(event, "lookup"));
