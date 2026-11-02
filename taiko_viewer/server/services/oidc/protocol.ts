import * as client from "openid-client";
import { httpsUrl, type OidcProvider } from "./config";

export async function discoverOidc(provider: OidcProvider) {
  // No redirects, arbitrary metadata URLs, or unbounded provider requests. The
  // issuer origin is needed only for discovery; other endpoints use an allowlist.
  const allowed = new Set([new URL(provider.issuer).origin, ...provider.endpointOrigins]);
  const config = await client.discovery(new URL(provider.issuer), provider.clientId, {
    token_endpoint_auth_method: provider.tokenEndpointAuthMethod,
    id_token_signed_response_alg: provider.idTokenSigningAlg
  }, provider.tokenEndpointAuthMethod === "none" ? client.None()
    : provider.tokenEndpointAuthMethod === "client_secret_post" ? client.ClientSecretPost(provider.clientSecret!)
    : client.ClientSecretBasic(provider.clientSecret!), {
    timeout: 10,
    [client.customFetch]: async (url, options) => {
      if (!allowed.has(httpsUrl(String(url)).origin)) throw new Error("Untrusted OIDC endpoint");
      const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(10_000) });
      let bytes = 0;
      const body = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > 256 * 1024) throw new Error("OIDC response too large");
          controller.enqueue(chunk);
        }
      }));
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  });
  const metadata = config.serverMetadata();
  if (metadata.issuer !== provider.issuer || !metadata.code_challenge_methods_supported?.includes("S256") || !metadata.response_types_supported?.includes("code")) throw new Error("Unsupported OIDC metadata");
  for (const key of ["authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
    if (!provider.endpointOrigins.includes(httpsUrl(metadata[key]).origin)) throw new Error("Untrusted OIDC endpoint");
  }
  // Code flow alone does not make openid-client perform non-repudiation signature
  // verification; explicitly enable it for every returned ID Token.
  client.enableNonRepudiationChecks(config);
  return config;
}

export { client };
