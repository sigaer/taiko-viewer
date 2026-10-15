import { defineEventHandler, getRequestURL } from "h3";
import { setPrivateNoStore } from "../utils/cache-policy.ts";

const PRIVATE_PREFIXES = [
  "/api/account/",
  "/api/admin/",
  "/api/internal/",
  "/api/developer/",
  "/api/taiko/proxy/",
  "/api/taiko/internal/",
  "/api/support/",
  "/api/forum/me/",
  "/api/forum/notifications",
  "/api/forum/preferences",
  "/api/forum/relationships"
];

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    setPrivateNoStore(event);
  }
});
