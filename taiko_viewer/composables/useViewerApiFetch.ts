type ViewerApiFetchOptions = Parameters<typeof $fetch>[1];

const createLocaleHeaders = (baseHeaders: HeadersInit | undefined, locale: string) => {
  const headers = new Headers(baseHeaders || {});
  headers.set("x-viewer-locale", locale);
  return headers;
};

export const useViewerApiFetch = () => {
  const { locale } = useI18n();
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie", "accept-language"]) : undefined;

  // Binding mutations invalidate the Home resolver without adding a Goal GET.
  // Capture Nuxt state during setup; do not call composables after the await.
  const homeResolvedUserId = useState<number | null>("home-state-resolved-user-id", () => null);
  const bindingGeneration = useState("account-binding-generation", () => 0);
  const homeGeneration = useState("account-home-generation", () => 0);
  return async <T>(request: Parameters<typeof $fetch<T>>[0], options: ViewerApiFetchOptions = {}) => {
    const result = await $fetch<T>(request, {
      ...options,
      headers: createLocaleHeaders(options.headers || requestHeaders, locale.value)
    });
    if (options.method && String(options.method).toUpperCase() !== "GET" && typeof request === "string" && /^\/api\/account\/(bindings|manual|qq)(?:\/|$)/.test(request)) {
      homeResolvedUserId.value = null;
      bindingGeneration.value += 1;
    }
    // A completed sync request invalidates the cached score-presence check.
    // Its response still determines success/failure in the existing sync UI.
    if (options.method && String(options.method).toUpperCase() !== "GET" && typeof request === "string" && (/^\/api\/account\/sync(?:\/|$)/.test(request) || request === "/api/account/growth/goal/evaluate-current")) {
      homeResolvedUserId.value = null;
      homeGeneration.value += 1;
    }
    return result;
  };
};
