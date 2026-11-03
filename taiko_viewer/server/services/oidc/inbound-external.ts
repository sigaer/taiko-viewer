/**
 * Reverse OurTaiko -> Viewer service API (SAKURA-PROTOCOL 0.1 §4).
 * Disabled by default; uses a NEW Viewer-issued service credential, never the
 * Sakura OIDC Client Secret used by Viewer -> OurTaiko.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { H3Event } from "h3";
import { getHeader, setHeader, setResponseStatus } from "h3";
import type { PoolConnection } from "mysql2/promise";
import { getAccountDb, ensureAccountSchema, type DbRow } from "../../utils/account-db";
import { verifyPasswordHash } from "../../internal/account/shared";
import { createMemoryRateLimiter } from "../../utils/rate-limit";
import { schemaRequirement, validateSchemaTables } from "../../utils/account-schema-runtime";
import { INBOUND_EXTERNAL_TABLES } from "./inbound-schema";

const ISSUER = "https://sso.ourtaiko.org";
const OUR_ID = /^[0-9a-f]{32}$/;
const VIEWER_ID = /^[1-9][0-9]{0,19}$/;
const MAX_UINT64 = 18446744073709551615n;
const WINDOW_SECONDS = 10 * 60;

type Action = "login" | "lookup" | "link" | "unlink" | "links";
type Code = "OK" | "REQUEST_INVALID" | "CONTENT_TYPE_INVALID" | "METHOD_NOT_ALLOWED" |
  "ORIGIN_INVALID" | "SERVICE_UNAUTHORIZED" | "SERVICE_FORBIDDEN" | "LOGIN_INVALID" |
  "NOT_FOUND" | "EMAIL_UNVERIFIED" | "ALREADY_LINKED" | "RATE_LIMITED" | "UNAVAILABLE";
type Body = Record<string, unknown>;

class Denied extends Error {
  constructor(readonly status: number, readonly code: Code) { super(code); }
}
const denied = (status: number, code: Code): never => { throw new Denied(status, code); };
const exact = (value: Body, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const accountId = (id: unknown): id is string =>
  typeof id === "string" && VIEWER_ID.test(id) && BigInt(id) <= MAX_UINT64;
const ourId = (id: unknown): id is string => typeof id === "string" && OUR_ID.test(id);
const iso = (date: unknown) => {
  const value = date instanceof Date ? date : new Date(String(date));
  if (!Number.isFinite(value.getTime())) denied(503, "UNAVAILABLE");
  return value.toISOString();
};
const noStore = (event: H3Event) => {
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
};
const response = (event: H3Event, status: number, code: Code, data: unknown = null) => {
  setResponseStatus(event, status);
  return { code, message: "", data };
};

// Strictly bounded body; do not allow stream/chunked requests with no fixed length.
async function jsonBody(event: H3Event): Promise<Body> {
  const contentType = getHeader(event, "content-type") || "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(contentType))
    denied(415, "CONTENT_TYPE_INVALID");
  const length = getHeader(event, "content-length") || "";
  if (!/^\d{1,5}$/.test(length) || Number(length) > 32 * 1024) denied(400, "REQUEST_INVALID");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.byteLength;
    if (size > 32 * 1024) denied(400, "REQUEST_INVALID");
    chunks.push(part);
  }
  if (size !== Number(length)) denied(400, "REQUEST_INVALID");
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) denied(400, "REQUEST_INVALID");
    return parsed as Body;
  } catch { return denied(400, "REQUEST_INVALID"); }
}

function requireService(event: H3Event) {
  if (process.env.TAIKO_OURTAIKO_INBOUND_ENABLED !== "1") denied(503, "UNAVAILABLE");
  if (event.node.req.method !== "POST") {
    setHeader(event, "Allow", "POST");
    denied(405, "METHOD_NOT_ALLOWED");
  }
  if (getHeader(event, "origin") !== undefined) denied(403, "ORIGIN_INVALID");
  const configuredId = process.env.TAIKO_OURTAIKO_INBOUND_SERVICE_ID || "";
  const configuredKey = process.env.TAIKO_OURTAIKO_INBOUND_SERVICE_KEY || "";
  if (!configuredId || configuredKey.length < 24) denied(503, "UNAVAILABLE");
  const receivedId = getHeader(event, "x-service-id") || "";
  const receivedKey = getHeader(event, "x-service-key") || "";
  if (receivedKey.length > 1024 || !receivedKey) denied(401, "SERVICE_UNAUTHORIZED");
  const a = createHash("sha256").update(receivedKey).digest();
  const b = createHash("sha256").update(configuredKey).digest();
  if (receivedId !== configuredId || !timingSafeEqual(a, b)) denied(401, "SERVICE_UNAUTHORIZED");
  return configuredId;
}

const ipLimit = createMemoryRateLimiter({windowMs:600_000,limit:45,maxBuckets:20000,message:"rate limited"});
const loginLimit = createMemoryRateLimiter({windowMs:600_000,limit:8,maxBuckets:20000,message:"rate limited"});
function enforceLoginLimit(event: H3Event, login: string) {
  const ip = getHeader(event, "x-end-user-ip") || "";
  if (!isIP(ip)) denied(400, "REQUEST_INVALID");
  const hash = createHash("sha256").update(login.toLowerCase()).digest("hex");
  try { ipLimit(event, ip); loginLimit(event, ip + ":" + hash); }
  catch { denied(429, "RATE_LIMITED"); }
}

async function audit(serviceId: string, action: Action, code: Code, viewer = "", subject = "") {
  await getAccountDb().execute(
    "INSERT INTO web_inbound_external_audit(attempt_id,service_id,action,viewer_id,ourtaiko_id,outcome) VALUES (?,?,?,?,?,?)",
    [randomBytes(32).toString("hex"), serviceId, action, viewer, subject, code]
  );
}
const unlockedPair = async (tx: PoolConnection, operationId: string) => {
  const [rows] = await tx.execute<DbRow<{ outcome: string; lease_live: number }>[]>(
    "SELECT outcome, lease_until>NOW() AS lease_live FROM web_oidc_remote_link_attempts WHERE operation_id=? ORDER BY created_at DESC,attempt_id DESC LIMIT 1",
    [operationId]
  );
  return !(rows[0]?.outcome === "pending" && rows[0]?.lease_live);
};
type Identity = { id: number; viewer_id: string; subject: Buffer; status: string; remote_link_status: string; remote_link_operation_id: string; created_at: Date | string };
async function pairRows(tx: PoolConnection, id: string, sub: string): Promise<Identity[]> {
  const [rows] = await tx.execute<DbRow<Identity>[]>(
    "SELECT id,CAST(user_id AS CHAR) viewer_id,subject,status,remote_link_status,remote_link_operation_id,created_at FROM web_external_identities WHERE issuer=? AND (user_id=? OR subject=?) FOR UPDATE",
    [ISSUER, id, sub]
  );
  return rows;
}
const subjectOf = (row: Identity) => Buffer.isBuffer(row.subject) ? row.subject.toString("utf8") : String(row.subject);
const verifiedProof = async (tx: PoolConnection, serviceId: string, viewerId: string) => {
  const [rows] = await tx.execute<DbRow<{ viewer_id: string }>[]>(
    "SELECT viewer_id FROM web_inbound_external_proofs WHERE service_id=? AND viewer_id=? AND expires_at>NOW() LIMIT 1",
    [serviceId, viewerId]
  );
  return Boolean(rows[0]);
};

async function doLogin(event: H3Event, service: string, body: Body) {
  if (!exact(body, ["login", "password"]) || typeof body.login !== "string" || typeof body.password !== "string" ||
      !body.login.trim() || body.login.length > 255 || !body.password || body.password.length > 1024)
    denied(400, "REQUEST_INVALID");
  const login = body.login.trim();
  enforceLoginLimit(event, login);
  await ensureAccountSchema();
  const [users] = await getAccountDb().execute<DbRow<{ id: string; password_hash: string }>[]>(
    "SELECT CAST(id AS CHAR) AS id,password_hash FROM web_user_accounts WHERE username=? OR email=? LIMIT 1",
    [login, login.toLowerCase()]
  );
  const user = users[0];
  // No Viewer session, cookie or bearer token is created by this endpoint.
  if (!user || !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(user.password_hash) ||
      !(await verifyPasswordHash(body.password, user.password_hash))) denied(401, "LOGIN_INVALID");
  await getAccountDb().execute(
    "INSERT INTO web_inbound_external_proofs(service_id,viewer_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)",
    [service, user.id]
  );
  return { id: user.id };
}

async function doLookup(service: string, body: Body) {
  if (!exact(body, ["id"]) || !accountId(body.id)) denied(400, "REQUEST_INVALID");
  const id = body.id;
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<{ id: string; username: string; email: string; email_verified: number }>[]>(
    "SELECT CAST(id AS CHAR) id,username,email,email_verified FROM web_user_accounts WHERE id=? LIMIT 1", [id]
  );
  const user = rows[0];
  if (!user) denied(404, "NOT_FOUND");
  const [bound] = await getAccountDb().execute<DbRow<{ subject: Buffer }>[]>(
    "SELECT subject FROM web_external_identities WHERE user_id=? AND issuer=? AND status='active' AND remote_link_status='linked' LIMIT 1",
    [id, ISSUER]
  );
  const [proof] = await getAccountDb().execute<DbRow<{ viewer_id: string }>[]>(
    "SELECT viewer_id FROM web_inbound_external_proofs WHERE service_id=? AND viewer_id=? AND expires_at>NOW() LIMIT 1",
    [service, id]
  );
  if (!bound.length && !proof.length) denied(404, "NOT_FOUND");
  if (!user.email_verified || !user.email) denied(409, "EMAIL_UNVERIFIED");
  return { id, nickname:user.username, email:user.email, emailVerified:true,
    linkedId:bound[0] ? (Buffer.isBuffer(bound[0].subject) ? bound[0].subject.toString("utf8") : String(bound[0].subject)) : null };
}

async function doLink(service: string, body: Body) {
  if (!exact(body, ["id", "externalId"]) || !accountId(body.id) || !ourId(body.externalId))
    denied(400, "REQUEST_INVALID");
  const id = body.id, sub = body.externalId;
  const db = await getAccountDb().getConnection();
  try {
    await db.beginTransaction();
    const pairs = await pairRows(db, id, sub);
    const match = pairs.find(r => r.viewer_id === id && subjectOf(r) === sub && r.status === "active");
    if (match?.remote_link_status === "linked") {
      await db.commit();
      return { id, externalId:sub, linkedAt:iso(match.created_at) };
    }
    // Never reveal conflicts without a fresh, valid password authentication.
    if (!(await verifiedProof(db, service, id))) denied(404, "NOT_FOUND");
    const [owners] = await db.execute<DbRow<{ id: string; email_verified: number }>[]>(
      "SELECT CAST(id AS CHAR) id,email_verified FROM web_user_accounts WHERE id=? FOR UPDATE", [id]);
    if (!owners[0]) denied(404, "NOT_FOUND");
    if (!owners[0].email_verified) denied(409, "EMAIL_UNVERIFIED");
    if (pairs.some(r => r.viewer_id !== id || subjectOf(r) !== sub || r.status !== "active"))
      denied(409, "ALREADY_LINKED");
    if (match) {
      if (!(await unlockedPair(db, match.remote_link_operation_id))) denied(503, "UNAVAILABLE");
      await db.execute("UPDATE web_external_identities SET remote_link_status='linked' WHERE id=?", [match.id]);
    } else {
      await db.execute(
        "INSERT INTO web_external_identities(user_id,provider_id,issuer,subject,status,remote_link_status,remote_link_operation_id) VALUES (?,'ourtaiko',?,?,'active','linked',?)",
        [id, ISSUER, sub, randomBytes(32).toString("hex")]
      );
    }
    const [created] = await db.execute<DbRow<{ created_at: Date | string }>[]>(
      "SELECT created_at FROM web_external_identities WHERE user_id=? AND issuer=? AND subject=?",
      [id, ISSUER, sub]);
    await db.commit();
    return { id, externalId:sub, linkedAt:iso(created[0]?.created_at) };
  } catch (error: any) {
    await db.rollback().catch(() => {});
    if (error?.code === "ER_DUP_ENTRY" || error?.code === "ER_LOCK_DEADLOCK" || error?.code === "ER_LOCK_WAIT_TIMEOUT") denied(409, "ALREADY_LINKED");
    throw error;
  } finally { db.release(); }
}

async function doUnlink(body: Body) {
  if (!exact(body, ["id", "externalId"]) || !accountId(body.id) || !ourId(body.externalId))
    denied(400, "REQUEST_INVALID");
  const id = body.id, sub = body.externalId;
  const db = await getAccountDb().getConnection();
  try {
    await db.beginTransaction();
    const pairs = await pairRows(db, id, sub);
    const match = pairs.find(r => r.viewer_id === id && subjectOf(r) === sub && r.status === "active");
    if (pairs.some(r => r.viewer_id === id && subjectOf(r) !== sub && r.status === "active"))
      denied(409, "ALREADY_LINKED");
    if (!match) denied(404, "NOT_FOUND");
    // A pending outbound HTTP may still commit remotely. Do not delete its
    // local fence while an unexpired operation is in flight.
    if (!(await unlockedPair(db, match.remote_link_operation_id))) denied(503, "UNAVAILABLE");
    await db.execute("DELETE FROM web_external_identities WHERE id=? AND user_id=? AND issuer=? AND subject=?", [match.id,id,ISSUER,sub]);
    await db.commit();
    // Account itself, existing Viewer sessions, scores and audit rows are retained.
    return { id, externalId:sub };
  } catch (error) {
    await db.rollback().catch(() => {});
    throw error;
  } finally { db.release(); }
}

async function doLinks(body: Body) {
  if (!exact(body, ["after"]) || typeof body.after !== "string" ||
      (body.after !== "" && !accountId(body.after))) denied(400, "REQUEST_INVALID");
  const after = body.after || "0";
  const [rows] = await getAccountDb().execute<DbRow<{ viewer_id: string; subject: Buffer; created_at: Date | string }>[]>(
    "SELECT CAST(user_id AS CHAR) viewer_id,subject,created_at FROM web_external_identities WHERE issuer=? AND status='active' AND remote_link_status='linked' AND user_id>CAST(? AS UNSIGNED) ORDER BY user_id LIMIT 1001",
    [ISSUER, after]
  );
  const links = rows.slice(0,1000).map(r => ({ id:r.viewer_id,externalId:Buffer.isBuffer(r.subject)?r.subject.toString("utf8"):String(r.subject),linkedAt:iso(r.created_at) }));
  return { links, next: rows.length > 1000 ? links[links.length-1].id : "" };
}

export async function handleInboundExternal(event: H3Event, action: Action) {
  noStore(event);
  let service = "", viewer = "", subject = "";
  try {
    service = requireService(event);
    const body = await jsonBody(event);
    if (typeof body.id === "string" && accountId(body.id)) viewer = body.id;
    if (typeof body.externalId === "string" && ourId(body.externalId)) subject = body.externalId;
    await validateSchemaTables(getAccountDb(), INBOUND_EXTERNAL_TABLES.map(schemaRequirement), "inbound-external");
    let data: unknown;
    if (action === "login") {
      data = await doLogin(event, service, body);
      viewer = (data as {id: string}).id;
    }
    else if (action === "lookup") data = await doLookup(service, body);
    else if (action === "link") data = await doLink(service, body);
    else if (action === "unlink") data = await doUnlink(body);
    else data = await doLinks(body);
    await audit(service, action, "OK", viewer, subject);
    return response(event, 200, "OK", data);
  } catch (error) {
    const status = error instanceof Denied ? error.status : 503;
    const code: Code = error instanceof Denied ? error.code : "UNAVAILABLE";
    if (status === 429) setHeader(event, "Retry-After", "600");
    if (service) await audit(service, action, code, viewer, subject).catch(() => {});
    return response(event, status, code);
  }
}
