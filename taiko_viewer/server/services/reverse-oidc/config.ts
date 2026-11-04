import { readFileSync, statSync } from 'node:fs';
export const VIEWER_ISSUER = 'https://viewer.sakura-bot.cn/oidc';
export const OURTAIKO_CALLBACK = 'https://sso.ourtaiko.org/login/sakura/callback/';

/** Server-only configuration. No fallback signing keys or reverse-direction secret. */
export function readProviderConfig() {
  if (process.env.TAIKO_OIDC_PROVIDER_ENABLED !== '1') return null;
  const path = process.env.TAIKO_OIDC_PROVIDER_CONFIG_FILE;
  if (!path || !path.startsWith('/')) throw Error('Private OIDC Provider configuration required');
  const info = statSync(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > 65536) throw Error('OIDC configuration must be a private bounded file');
  let config: any;
  try { config = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw Error('Invalid private OIDC Provider configuration'); }
  if (config.clientId !== 'OurTaiko' || typeof config.clientSecret !== 'string' || config.clientSecret.length < 32)
    throw Error('Distinct OurTaiko confidential client required');
  if (!Array.isArray(config.cookieKeys) || !config.cookieKeys.length || config.cookieKeys.some((key: any) => typeof key !== 'string' || key.length < 32))
    throw Error('Persistent Provider cookie keys required');
  if (!Array.isArray(config.jwks?.keys) || !config.jwks.keys.length || config.jwks.keys.some((key: any) =>
    key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig' || !key.kid || !key.d || !key.n || !key.e))
    throw Error('Private RS256 signing JWKS required');
  if (new Set(config.jwks.keys.map((key: any) => key.kid)).size !== config.jwks.keys.length) throw Error('Unique signing key IDs required');
  return config;
}
