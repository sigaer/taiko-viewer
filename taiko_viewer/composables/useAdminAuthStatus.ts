import type { AdminAuthPayload, AdminAuthUser } from "~/types/admin";

export const useAdminAuthStatus = () => {
  const adminUser = useState<AdminAuthUser | null>("taiko-admin-user", () => null);
  const adminLoaded = useState<boolean>("taiko-admin-user-loaded", () => false);
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  const fetchAdminAuthPayload = async () =>
    $fetch<AdminAuthPayload>("/api/admin/auth/me", {
      headers: requestHeaders,
      timeout: 10_000,
      retry: 0
    });

  const acceptAdminAuthPayload = (payload: AdminAuthPayload) => {
    adminUser.value = payload.authenticated && payload.user ? payload.user : null;
    adminLoaded.value = true;
    return adminUser.value;
  };

  const resolveAdminUser = async (force = false) => {
    if (adminLoaded.value && !force) {
      return adminUser.value;
    }
    try {
      const payload = await fetchAdminAuthPayload();
      adminUser.value = payload.user;
    } catch {
      adminUser.value = null;
    } finally {
      adminLoaded.value = true;
    }
    return adminUser.value;
  };

  const isAuthenticated = async (force = false) => Boolean(await resolveAdminUser(force));

  const clearResolvedAdminUser = () => {
    adminUser.value = null;
    adminLoaded.value = true;
  };

  return {
    adminUser,
    adminLoaded,
    resolveAdminUser,
    acceptAdminAuthPayload,
    isAuthenticated,
    clearResolvedAdminUser
  };
};
