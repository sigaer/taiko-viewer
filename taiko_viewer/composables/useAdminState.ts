export const useAdminState = () => {
  const {
    adminUser,
    adminLoaded,
    resolveAdminUser,
    clearResolvedAdminUser
  } = useAdminAuthStatus();

  const fetchCurrentAdmin = async (force = false) => resolveAdminUser(force);

  return {
    adminUser,
    adminLoaded,
    fetchCurrentAdmin,
    clearAdminUser: clearResolvedAdminUser
  };
};
