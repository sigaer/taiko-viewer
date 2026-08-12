import { setPrivateNoStore } from "~/server/utils/cache-policy";

const PRIVATE_PREFIXES = [
  "/api/account/",
  "/api/admin/",
  "/api/internal/",
  "/api/developer/",
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
