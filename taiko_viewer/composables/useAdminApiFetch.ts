type AdminApiFetchOptions = Parameters<typeof $fetch>[1];

export const useAdminApiFetch = () => {
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

  return <T>(request: Parameters<typeof $fetch<T>>[0], options: AdminApiFetchOptions = {}) =>
    $fetch<T>(request, {
      ...options,
      headers: new Headers(options.headers || requestHeaders || {})
    });
};
