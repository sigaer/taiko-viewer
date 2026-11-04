/** The OIDC consent endpoint is a Nitro server route, not a Vue page.
 * After password login, a client-side Nuxt navigation would render a Vue 404.
 * Force a browser request only for the strict, same-origin interaction route.
 */
// Require the absolute end of the string; `$` also accepts a final newline.
const PROVIDER_INTERACTION = /^\/oidc\/interaction\/[A-Za-z0-9_-]{1,255}(?![\s\S])/;

export function authReturnNavigationOptions(target: string): { external: boolean } {
  return { external: PROVIDER_INTERACTION.test(target) };
}
