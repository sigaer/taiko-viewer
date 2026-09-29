/** Internal fixed-size exports must not include the site's animated decoration. */
export const isAnnualCapturePath = (path: string) =>
  /^\/(?:ja\/)?account\/annual-(?:share-card|poster)\/[^/]+\/?$/.test(path);
