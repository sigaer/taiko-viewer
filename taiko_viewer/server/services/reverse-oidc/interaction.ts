import { createHash, randomBytes } from 'node:crypto';
import { createError, getCookie, getHeader, send, sendRedirect, setHeader, type H3Event } from 'h3';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getAccountDb } from '../../utils/account-db';
import { authorizationBinding } from './adapter';
import { canonicalViewerSubject } from './account';
import { getViewerProvider } from './provider';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function browserAccount(event: H3Event) {
  const token = getCookie(event, 'stv_session');
  if (!token || token.length > 512) return null;
  const [rows] = await getAccountDb().execute<RowDataPacket[]>(`SELECT CAST(a.id AS CHAR) subject,a.username
    FROM web_user_sessions s JOIN web_user_accounts a ON a.id=s.user_id
    WHERE s.session_token=? AND s.expires_at>NOW() LIMIT 1`, [token]);
  const subject = canonicalViewerSubject(rows[0]?.subject);
  return subject ? { subject, sessionHash: hash(token), username: rows[0].username } : null;
}

export async function handleViewerInteraction(event: H3Event, uid: string) {
  const provider = getViewerProvider();
  if (!provider) throw createError({statusCode:404});
  for (const [name,value] of Object.entries({ 'Cache-Control':'no-store', 'Referrer-Policy':'same-origin',
    'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://sso.ourtaiko.org/login/sakura/callback/; frame-ancestors 'none'; base-uri 'none'" })) setHeader(event,name,value);
  const { req,res } = event.node;
  const details = await provider.interactionDetails(req,res);
  if (details.uid !== uid || details.params.client_id !== 'OurTaiko') throw createError({statusCode:400});
  const account = await browserAccount(event);
  const target = `/oidc/interaction/${uid}`;
  if (!account) {
    if (event.method !== 'GET') throw createError({statusCode:401,statusMessage:'Viewer session expired'});
    return sendRedirect(event, `/account/login?redirect=${encodeURIComponent(target)}`);
  }
  const db = getAccountDb();
  if (event.method === 'GET') {
    const csrf = randomBytes(32).toString('base64url');
    await db.execute(`INSERT INTO web_oidc_provider_consent (interaction_id,csrf_hash,subject,session_hash,expires_at)
      VALUES (?,?,?,?,UNIX_TIMESTAMP()+600) ON DUPLICATE KEY UPDATE
      csrf_hash=IF(subject=VALUES(subject) AND session_hash=VALUES(session_hash),VALUES(csrf_hash),csrf_hash)`,
    [uid,hash(csrf),account.subject,account.sessionHash]);
    const [rows] = await db.execute<RowDataPacket[]>('SELECT csrf_hash,subject,session_hash FROM web_oidc_provider_consent WHERE interaction_id=? AND expires_at>UNIX_TIMESTAMP()', [uid]);
    if (rows[0]?.csrf_hash !== hash(csrf) || rows[0]?.subject !== account.subject || rows[0]?.session_hash !== account.sessionHash)
      throw createError({statusCode:409,statusMessage:'Viewer session changed; restart authorization'});
    const scopes = String(details.params.scope || '').split(' ');
    const fields = ['账号 ID', ...(scopes.includes('profile') ? ['用户名'] : []), ...(scopes.includes('email') ? ['已验证邮箱及验证状态'] : [])];
    return send(event, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>授权 OurTaiko · Sakura Viewer</title><style>
      :root{color-scheme:light;--bg:#f7f6f8;--text:#24212c;--muted:#595260;--accent:#9d2757;--line:#dcd6de}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,sans-serif}
      main{max-width:480px;margin:8vh auto;padding:32px;background:white;border:1px solid var(--line);border-radius:20px}
      h1{font-size:24px;margin:20px 0}p{overflow-wrap:anywhere}.brand{color:var(--accent);font-weight:700}.account{padding:16px;background:var(--bg);border-radius:12px}
      ul{padding-left:24px;color:var(--muted)}form{display:flex;gap:12px;margin-top:28px}button{min-height:48px;padding:12px 22px;border:1px solid var(--line);border-radius:10px;background:white;color:var(--text);font:inherit;cursor:pointer;flex:1}
      button[value=allow]{background:var(--accent);color:white;border-color:var(--accent)}button:focus-visible{outline:3px solid #282050;outline-offset:3px}@media(max-width:520px){main{margin:24px 16px;padding:24px}}
      </style></head><body><main><div class="brand">Sakura Viewer</div><h1>授权 OurTaiko</h1><p class="account">当前账号：<strong>${escape(account.username)}</strong></p><p>OurTaiko 将获得：</p><ul>${fields.map(field=>`<li>${field}</li>`).join('')}</ul><form method="post" action="${target}"><input type="hidden" name="csrf" value="${csrf}"><button type="submit" name="decision" value="deny">取消</button><button type="submit" name="decision" value="allow">同意并继续</button></form></main></body></html>`, 'text/html; charset=utf-8');
  }
  if (event.method !== 'POST') throw createError({statusCode:405});
  if (getHeader(event,'origin') !== 'https://viewer.sakura-bot.cn' || !getHeader(event,'content-type')?.startsWith('application/x-www-form-urlencoded'))
    throw createError({statusCode:403,statusMessage:'Invalid authorization origin'});
  if (Number(getHeader(event,'content-length') || 0) > 4096) throw createError({statusCode:413});
  let encoded = '';
  let bytes = 0;
  for await (const chunk of event.node.req) {
    bytes += chunk.length;
    if (bytes > 4096) throw createError({statusCode:413});
    encoded += chunk.toString('utf8');
  }
  const params = new URLSearchParams(encoded);
  if (params.getAll('csrf').length !== 1 || params.getAll('decision').length !== 1) throw createError({statusCode:400});
  const body = {csrf:params.get('csrf'),decision:params.get('decision')};
  if (typeof body?.csrf !== 'string' || body.csrf.length > 128 || !['allow','deny'].includes(body.decision)) throw createError({statusCode:400});
  const [deleted] = await db.execute<ResultSetHeader>(`DELETE FROM web_oidc_provider_consent WHERE interaction_id=? AND csrf_hash=?
    AND subject=? AND session_hash=? AND expires_at>UNIX_TIMESTAMP()`, [uid,hash(body.csrf),account.subject,account.sessionHash]);
  if (deleted.affectedRows !== 1) throw createError({statusCode:409,statusMessage:'Authorization expired or Viewer session changed'});
  if (body.decision === 'deny') {
    await provider.interactionFinished(req,res,{error:'access_denied',error_description:'Authorization declined'},{mergeWithLastSubmission:false});
    return;
  }
  return authorizationBinding.run(account, async () => {
    // Recheck after the CSRF record is consumed and before granting this account.
    const current = await browserAccount(event);
    if (!current || current.sessionHash !== account.sessionHash || current.subject !== account.subject) throw createError({statusCode:401});
    const grant = new provider.Grant({accountId:account.subject,clientId:'OurTaiko'});
    grant.addOIDCScope(String(details.params.scope));
    const grantId = await grant.save();
    await provider.interactionFinished(req,res,{login:{accountId:account.subject,remember:false},consent:{grantId}},{mergeWithLastSubmission:false});
  });
}
