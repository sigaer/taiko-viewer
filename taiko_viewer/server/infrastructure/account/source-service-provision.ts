import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { isSiteOperator } from './operator.ts';
import { validateSourceServicePolicy } from './source-service-schema.ts';
import { validateServicePrincipals } from './principal-policy.ts';

export class SourceServiceProvisionError extends Error {
  readonly statusCode: number;
  constructor(statusCode = 503) { super('Source service configuration unavailable'); this.statusCode = statusCode; }
}
type Request = Readonly<{ operationId: string; operatorUserId: string; tokenId: string;
  serviceName: string; status: 'active' | 'revoked'; scopesJson: string; sourcesJson: string; principalsJson:string|null; expiresAt: string | null }>;
const id = (value: unknown) => {
  const text = typeof value === 'string' ? value : Number.isSafeInteger(value) ? String(value) : '';
  if (!/^[1-9][0-9]{0,19}$/.test(text) || BigInt(text) > 18446744073709551615n) throw new SourceServiceProvisionError(400);
  return text;
};
export function parseSourceServiceRequest(input: unknown): Request {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SourceServiceProvisionError(400);
  const body = input as Record<string, unknown>;
  if (typeof body.operationId !== 'string' || !/^[a-f0-9]{32}$/.test(body.operationId) ||
    typeof body.serviceName !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body.serviceName) ||
    !['active', 'revoked'].includes(String(body.status))) throw new SourceServiceProvisionError(400);
  let policy;
  try { policy = validateSourceServicePolicy(body.scopes, body.sources); } catch { throw new SourceServiceProvisionError(400); }
  let principalsJson:string|null=null;
  try{if(body.principals!==undefined&&body.principals!==null)principalsJson=JSON.stringify(validateServicePrincipals(body.principals));}
  catch{throw new SourceServiceProvisionError(400);}
  if(policy.scopes.some(scope=>scope.startsWith('bind_')||scope==='hiroba_bind')&&principalsJson===null)throw new SourceServiceProvisionError(400);
  const expiresAt = body.expiresAt === undefined || body.expiresAt === null ? null : body.expiresAt;
  if (expiresAt !== null && (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(expiresAt) ||
    !Number.isFinite(Date.parse(expiresAt.replace(' ', 'T') + 'Z')) ||
    new Date(expiresAt.replace(' ', 'T') + 'Z').toISOString().slice(0, 19).replace('T', ' ') !== expiresAt)) throw new SourceServiceProvisionError(400);
  return Object.freeze({ operationId: body.operationId, operatorUserId: id(body.operatorUserId), tokenId: id(body.tokenId),
    serviceName: body.serviceName, status: body.status as Request['status'], scopesJson: JSON.stringify(policy.scopes),
    sourcesJson: JSON.stringify(policy.sources),principalsJson, expiresAt: expiresAt as string | null });
}
type Executor = Pick<Pool | PoolConnection, 'execute'>;
const AUDIT_SELECT = `SELECT operation_id,CAST(developer_token_id AS CHAR) AS token_id,CAST(operator_user_id AS CHAR) AS operator_id,
  service_name,status,scopes_json,sources_json,principals_json,DATE_FORMAT(expires_at,'%Y-%m-%d %H:%i:%s') AS expires_at
  FROM taiko_source_service_grant_audit WHERE operation_id=?`;
const TOKEN_SELECT = `SELECT CAST(id AS CHAR) AS id,CAST(user_id AS CHAR) AS user_id,token_hash,status,revoked_at
  FROM web_developer_tokens WHERE id=?`;
const auditMatches = (row: RowDataPacket, request: Request) => row.operation_id === request.operationId &&
  row.token_id === request.tokenId && row.operator_id === request.operatorUserId && row.service_name === request.serviceName &&
  row.status === request.status && row.scopes_json === request.scopesJson && row.sources_json === request.sourcesJson && row.principals_json===request.principalsJson && row.expires_at === request.expiresAt;
const receipt = (request: Request, replayed: boolean) => Object.freeze({ operationId: request.operationId,
  tokenId: request.tokenId, serviceName: request.serviceName, status: request.status, replayed });
async function proveOperator(db: Executor, request: Request, tokenUser: string, locked: boolean) {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT CAST(id AS CHAR) AS id,username,email FROM web_user_accounts
    WHERE id IN (?,?) ORDER BY id${locked ? ' FOR UPDATE' : ''}`, [request.operatorUserId, tokenUser]);
  const operator = rows.find(row => row.id === request.operatorUserId);
  if (!rows.some(row => row.id === tokenUser) || !isSiteOperator(operator ? { username: operator.username, email: operator.email } : null)) throw new SourceServiceProvisionError(403);
}
async function captureToken(db: Executor, request: Request, locked: boolean) {
  const [rows] = await db.execute<RowDataPacket[]>(TOKEN_SELECT + (locked ? ' FOR UPDATE' : ''), [request.tokenId]);
  const token = rows[0];
  if (!token || (request.status === 'active' && (token.status !== 'active' || token.revoked_at !== null))) throw new SourceServiceProvisionError(403);
  return token;
}
/** Trusted OS/CLI only. No HTTP route accepts operator or service grant input.
 * Account -> token -> grant -> audit locks, one SQL COMMIT; no source mutation. */
export async function provisionSourceService(db: Pool, input: unknown, { apply = false } = {}) {
  const request = parseSourceServiceRequest(input);
  let connection: PoolConnection | undefined, committedAttempt = false, discard = false;
  try {
    const initial = await captureToken(db, request, false);
    await proveOperator(db, request, initial.user_id, false);
    if (!apply) return { ...receipt(request, false), action: 'inspect' as const };
    connection = await db.getConnection(); await connection.beginTransaction();
    await proveOperator(connection, request, initial.user_id, true);
    const token = await captureToken(connection, request, true);
    if (token.user_id !== initial.user_id || token.token_hash !== initial.token_hash) throw new SourceServiceProvisionError(409);
    await connection.execute('SELECT id FROM taiko_source_service_grants WHERE developer_token_id=? FOR UPDATE', [request.tokenId]);
    const [prior] = await connection.execute<RowDataPacket[]>(AUDIT_SELECT + ' FOR UPDATE', [request.operationId]);
    if (prior[0]) {
      if (!auditMatches(prior[0], request)) throw new SourceServiceProvisionError(409);
      await connection.rollback(); return receipt(request, true);
    }
    if (request.status === 'active' && request.expiresAt !== null) {
      const [[clock]] = await connection.execute<RowDataPacket[]>('SELECT CAST(? AS DATETIME)>NOW() AS future', [request.expiresAt]);
      if (!clock?.future) throw new SourceServiceProvisionError(400);
    }
    await connection.execute(`INSERT INTO taiko_source_service_grants(developer_token_id,developer_user_id,service_name,scopes_json,sources_json,principals_json,
      revision_nonce,status,issued_by_user_id,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
      developer_user_id=VALUES(developer_user_id),service_name=VALUES(service_name),scopes_json=VALUES(scopes_json),sources_json=VALUES(sources_json),
      principals_json=VALUES(principals_json),revision_nonce=VALUES(revision_nonce),status=VALUES(status),issued_by_user_id=VALUES(issued_by_user_id),expires_at=VALUES(expires_at)`,
    [request.tokenId, token.user_id, request.serviceName, request.scopesJson, request.sourcesJson,request.principalsJson, request.operationId, request.status, request.operatorUserId, request.expiresAt]);
    await connection.execute(`INSERT INTO taiko_source_service_grant_audit(operation_id,developer_token_id,operator_user_id,service_name,status,scopes_json,sources_json,principals_json,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?)`, [request.operationId, request.tokenId, request.operatorUserId, request.serviceName, request.status, request.scopesJson, request.sourcesJson,request.principalsJson, request.expiresAt]);
    committedAttempt = true; await connection.commit(); return receipt(request, false);
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch { discard = true; connection.destroy(); } }
    if (committedAttempt) {
      // Resolve a lost COMMIT acknowledgement from a fresh connection to the
      // same captured pool. The durable operation must not overwrite newer policy.
      try {
        const token = await captureToken(db, request, false); await proveOperator(db, request, token.user_id, false);
        const [rows] = await db.execute<RowDataPacket[]>(AUDIT_SELECT, [request.operationId]);
        if (rows[0] && auditMatches(rows[0], request)) return receipt(request, true);
      } catch { /* fixed public diagnostic below */ }
    }
    throw error instanceof SourceServiceProvisionError ? error : new SourceServiceProvisionError();
  } finally { if (connection && !discard) connection.release(); }
}
