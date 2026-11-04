import type { Pool } from 'mysql2/promise';
import Provider, { interactionPolicy, errors } from 'oidc-provider';
import { getAccountDb } from '../../utils/account-db';
import { findViewerOidcAccount } from './account';
import { databaseAdapter } from './adapter';
import { readProviderConfig, VIEWER_ISSUER, OURTAIKO_CALLBACK } from './config';

let instance: Provider | undefined;
export function getViewerProvider() {
  if (instance) return instance;
  const privateConfig = readProviderConfig();
  if (!privateConfig) return null;
  try { instance = createViewerProvider(getAccountDb(), privateConfig); }
  catch { throw Error('Viewer OIDC Provider configuration unavailable'); }
  return instance;
}

export function createViewerProvider(db: Pool, privateConfig: any) {
  const policy = interactionPolicy.base();
  // Every authorization explicitly reconfirms the current Viewer browser session.
  policy.get('login')!.checks.add(new interactionPolicy.Check('viewer_session', 'Viewer confirmation required',
    (ctx: any) => !ctx.oidc.result?.login));
  const provider = new Provider(VIEWER_ISSUER, {
    adapter: databaseAdapter(db),
    clients: [{ client_id: 'OurTaiko', client_secret: privateConfig.clientSecret,
      client_name: 'OurTaiko', redirect_uris: [OURTAIKO_CALLBACK],
      response_types: ['code'], grant_types: ['authorization_code'],
      token_endpoint_auth_method: 'client_secret_basic', id_token_signed_response_alg: 'RS256' }],
    jwks: privateConfig.jwks,
    cookies: { keys: privateConfig.cookieKeys,
      names: { session: '_viewer_op_session', interaction: '_viewer_op_interaction', resume: '_viewer_op_resume' },
      long: { httpOnly: true, sameSite: 'lax', secure: true }, short: { httpOnly: true, sameSite: 'lax', secure: true } },
    features: { devInteractions: { enabled: false }, registration: { enabled: false },
      claimsParameter: { enabled: false }, requestObjects: { request: false, requestUri: false },
      revocation: { enabled: true } },
    scopes: ['openid', 'profile', 'email'],
    claims: { openid: ['sub'], profile: ['preferred_username'], email: ['email', 'email_verified'] },
    responseTypes: ['code'], subjectTypes: ['public'],
    pkce: { required: () => true },
    enabledJWA: { idTokenSigningAlgValues: ['RS256'] },
    ttl: { AuthorizationCode: 60, AccessToken: 300, IdToken: 300, Interaction: 600, Session: 600, Grant: 600 },
    interactions: { policy, url: (_ctx: any, interaction: any) => `/oidc/interaction/${interaction.uid}` },
    async loadExistingGrant(ctx: any) {
      const id = ctx.oidc.result?.consent?.grantId;
      return id ? provider.Grant.find(id) : undefined;
    },
    findAccount: (_ctx: any, sub: string) => findViewerOidcAccount(db, sub),
    renderError: async (ctx: any) => {
      ctx.type = 'html';
      ctx.body = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>授权未完成</title><p>授权请求无效或已过期，请返回 OurTaiko 重新登录。</p></html>';
    }
  });
  provider.proxy = true;
  provider.use(async (ctx: any, next: any) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.set('Referrer-Policy', 'no-referrer');
    if (ctx.protocol !== 'https' || ctx.host !== 'viewer.sakura-bot.cn') throw new errors.InvalidRequest('Unexpected Provider origin');
    // Only S256 is accepted. oidc-provider performs the protocol and proof checks.
    if (ctx.path === '/auth' && (ctx.method !== 'GET' || ctx.query.code_challenge_method !== 'S256' || !ctx.query.nonce))
      throw new errors.InvalidRequest('S256 and nonce required');
    await next();
  });
  return provider;
}
