import { createError } from "h3";

export type OidcProvider = {
  id: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  tokenEndpointAuthMethod: "none" | "client_secret_basic" | "client_secret_post";
  idTokenSigningAlg: "RS256" | "PS256" | "ES256";
  redirectUri: string;
  scopes: string[];
  endpointOrigins: string[];
};

const unavailable = () => createError({ statusCode: 503, statusMessage: "External login unavailable" });
export const httpsUrl = (value: unknown): URL => {
  if (typeof value !== "string") throw unavailable();
  let url: URL;
  try { url = new URL(value); } catch { throw unavailable(); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw unavailable();
  return url;
};

/** Server-only configuration. No issuer, endpoint, client or callback comes from a request. */
export function oidcProviders(): OidcProvider[] {
  const config = useRuntimeConfig();
  const enabled: unknown = config.oidcEnabled;
  if (enabled !== true && enabled !== "1" && enabled !== 1) return [];
  try {
    // Nitro parses runtime environment values with destr, so JSON can arrive as
    // an array and NUXT_OIDC_ENABLED=1 can arrive as a number.
    const raw: unknown = config.oidcProvidersJson;
    const entries = Array.isArray(raw) ? raw : JSON.parse(String(raw || "[]"));
    if (!Array.isArray(entries) || entries.length > 16) throw unavailable();
    const ids = new Set<string>(), issuers = new Set<string>();
    return entries.filter(p => p?.enabled === true).map(p => {
      if (typeof p.id !== "string" || !/^[a-z][a-z0-9-]{0,47}$/.test(p.id) || ids.has(p.id)) throw unavailable();
      const issuer = httpsUrl(p.issuer), callback = httpsUrl(p.redirectUri);
      if (issuer.search || Buffer.byteLength(p.issuer) > 512 || issuers.has(p.issuer)) throw unavailable();
      if (callback.search || callback.pathname !== `/api/account/oidc/${p.id}/callback`) throw unavailable();
      if (typeof p.clientId !== "string" || !p.clientId || p.clientId.length > 255) throw unavailable();
      if (p.clientSecret !== undefined && typeof p.clientSecret !== "string") throw unavailable();
      const method = p.tokenEndpointAuthMethod || (p.clientSecret ? "client_secret_basic" : "none");
      if (!["none", "client_secret_basic", "client_secret_post"].includes(method) || (method !== "none" && (typeof p.clientSecret !== "string" || !p.clientSecret))) throw unavailable();
      const signingAlg = p.idTokenSigningAlg || "RS256";
      if (!["RS256", "PS256", "ES256"].includes(signingAlg)) throw unavailable();
      const scopes = p.scopes ?? ["openid", "email", "profile"];
      if (!Array.isArray(scopes) || !scopes.includes("openid") || scopes.length > 16 || scopes.some(s => typeof s !== "string" || !/^[\x21\x23-\x5b\x5d-\x7e]{1,64}$/.test(s))) throw unavailable();
      const origins = p.endpointOrigins ?? [issuer.origin];
      if (!Array.isArray(origins) || !origins.length || origins.length > 8 || origins.some(o => httpsUrl(o).origin !== o)) throw unavailable();
      ids.add(p.id); issuers.add(p.issuer);
      return { id: p.id, label: typeof p.label === "string" ? p.label.slice(0, 80) : p.id, issuer: p.issuer, clientId: p.clientId,
        clientSecret: p.clientSecret, tokenEndpointAuthMethod: method, idTokenSigningAlg: signingAlg, redirectUri: callback.href, scopes, endpointOrigins: origins };
    });
  } catch { throw unavailable(); }
}

export function oidcProvider(id: string) {
  const provider = oidcProviders().find(p => p.id === id);
  if (!provider) throw createError({ statusCode: 404, statusMessage: "External login unavailable" });
  return provider;
}

export function safeOidcReturnPath(input: unknown, fallback = "/account/profile"): string {
  if (typeof input !== "string" || input.length > 1024 || !input.startsWith("/") || input.startsWith("//")) return fallback;
  // Decode repeatedly to reject browser/proxy path reinterpretation and encoded protocol-relative URLs.
  let decoded = input;
  for (let i = 0; i < 4; i++) {
    if (/[\\\x00-\x20\x7f]/.test(decoded) || decoded.startsWith("//")) return fallback;
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { return fallback; }
  }
  if (/[\\\x00-\x20\x7f]/.test(decoded)) return fallback;
  const path = new URL(input, "https://viewer.invalid");
  const decodedPath = new URL(decoded, path.origin);
  if (path.origin !== "https://viewer.invalid" || decodedPath.origin !== path.origin || path.pathname.startsWith("//") || decodedPath.pathname.startsWith("//") || /^\/(?:ja\/)?api(?:\/|$)/.test(decodedPath.pathname)) return fallback;
  return path.pathname + path.search + path.hash;
}
