export const useAdminState = () => {
  const {
    adminUser,
    adminLoaded,
    resolveAdminUser,
    acceptAdminAuthPayload,
    clearResolvedAdminUser
  } = useAdminAuthStatus();

  const fetchCurrentAdmin = async (force = false) => resolveAdminUser(force);

  return {
    adminUser,
    adminLoaded,
    fetchCurrentAdmin,
    acceptAdminAuthPayload,
    clearAdminUser: clearResolvedAdminUser
  };
};
