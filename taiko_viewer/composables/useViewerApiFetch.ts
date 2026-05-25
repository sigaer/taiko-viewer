type ViewerApiFetchOptions = Parameters<typeof $fetch>[1];

const createLocaleHeaders = (baseHeaders: HeadersInit | undefined, locale: string) => {
  const headers = new Headers(baseHeaders || {});
  headers.set("x-viewer-locale", locale);
  return headers;
};

export const useViewerApiFetch = () => {
  const { locale } = useI18n();
  const requestHeaders = import.meta.server ? useRequestHeaders(["cookie", "accept-language"]) : undefined;

  return <T>(request: Parameters<typeof $fetch<T>>[0], options: ViewerApiFetchOptions = {}) =>
    $fetch<T>(request, {
      ...options,
      headers: createLocaleHeaders(options.headers || requestHeaders, locale.value)
    });
};
