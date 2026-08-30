import type { H3Event } from "h3";
import { createError, deleteCookie, getCookie, getHeader, setCookie } from "h3";
import type { FetchOptions } from "ofetch";
import { ensureNonEmpty, getSecureCookieFlag } from "~/server/internal/account/shared";
import { recordAdminAction } from "./audit";
import { getAdminRuntimeConfig } from "./shared";

export const ADMIN_SESSION_COOKIE_NAME = "taiko_admin_session";

export type TaikoAdminUser = {
  id: number;
  username: string;
  expiresAt: string;
  exp: number;
};

type TaikoAdminSession = {
  token: string;
  user: TaikoAdminUser;
};

type RemoteResult<T> = {
  code: number;
  msg: string;
  data: T;
};

const getAdminTokenFromEvent = (event: H3Event) => {
  const authHeader = String(getHeader(event, "authorization") || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return getCookie(event, ADMIN_SESSION_COOKIE_NAME) || "";
};

const clearAdminSession = (event: H3Event) => {
  deleteCookie(event, ADMIN_SESSION_COOKIE_NAME, { path: "/" });
};

const setAdminSession = (event: H3Event, token: string, user: TaikoAdminUser) => {
  setCookie(event, ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(event),
    path: "/",
    expires: new Date(user.exp * 1000)
  });
};

const normalizeRemoteErrorMessage = (error: any) =>
  String(error?.data?.msg || error?.data?.statusMessage || error?.statusMessage || error?.message || "").trim();

export const fetchTaikoAdminResult = async <T>(
  path: string,
  options: FetchOptions<"json"> & { token?: string } = {}
) => {
  const config = getAdminRuntimeConfig();
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  let result: RemoteResult<T>;
  try {
    result = await $fetch<RemoteResult<T>>(path, {
      ...options,
      baseURL: config.taikoAdminApiBase,
      headers
    });
  } catch (error: any) {
    const message = normalizeRemoteErrorMessage(error) || "Taiko 管理接口请求失败";
    const statusCode = Number(error?.response?.status || error?.statusCode || 502);
    throw createError({
      statusCode: Number.isFinite(statusCode) ? statusCode : 502,
      statusMessage: message
    });
  }

  if (Number(result?.code) !== 0) {
    const message = String(result?.msg || "Taiko 管理接口返回异常").trim();
    const statusCode = /token|登录|鉴权/i.test(message) ? 401 : 400;
    throw createError({
      statusCode,
      statusMessage: message
    });
  }

  return result.data;
};

export const getTaikoAdminSession = async (event: H3Event): Promise<TaikoAdminSession | null> => {
  const token = getAdminTokenFromEvent(event);
  if (!token) {
    return null;
  }
  try {
    const user = await verifyTaikoAdminToken(token);
    return { token, user };
  } catch (error: any) {
    if (Number(error?.statusCode || 0) === 401) {
      clearAdminSession(event);
      return null;
    }
    throw error;
  }
};

const normalizeVerifiedAdminUser = (value: unknown): TaikoAdminUser | null => {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const id = Number(data.id);
  const exp = Number(data.exp);
  const username = String(data.username || "").trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !username || !Number.isFinite(exp) || exp * 1000 <= Date.now()) {
    return null;
  }
  return {
    id,
    username,
    exp,
    expiresAt: new Date(exp * 1000).toISOString()
  };
};

const verifyTaikoAdminToken = async (token: string): Promise<TaikoAdminUser> => {
  try {
    const data = await fetchTaikoAdminResult<unknown>("/taiko/manage/auth/me", {
      method: "GET",
      token
    });
    const user = normalizeVerifiedAdminUser(data);
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: "管理端令牌身份无效" });
    }
    return user;
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || error?.response?.status || 0);
    if (statusCode === 401) {
      throw createError({ statusCode: 401, statusMessage: "管理端令牌无效或已过期" });
    }
    throw createError({ statusCode: 503, statusMessage: "管理端认证服务暂不可用" });
  }
};

export const requireTaikoAdminSession = async (event: H3Event) => {
  const session = await getTaikoAdminSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "请先登录太鼓管理后台" });
  }
  return session;
};

export const withTaikoAdminToken = async <T>(
  event: H3Event,
  runner: (token: string, user: TaikoAdminUser) => Promise<T>
) => {
  const session = await requireTaikoAdminSession(event);
  try {
    return await runner(session.token, session.user);
  } catch (error: any) {
    if (Number(error?.statusCode || 0) === 401) {
      clearAdminSession(event);
    }
    throw error;
  }
};

export const loginTaikoAdmin = async (
  event: H3Event,
  payload: { username?: unknown; password?: unknown }
) => {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  ensureNonEmpty(username, "请输入管理员用户名");
  ensureNonEmpty(password, "请输入管理员密码");

  try {
    const token = await fetchTaikoAdminResult<string>("/taiko/login", {
      method: "POST",
      body: {
        username,
        password
      }
    });
    const user = await verifyTaikoAdminToken(token);
    setAdminSession(event, token, user);
    await recordAdminAction({
      actorType: "admin",
      actorId: String(user.id || username),
      actorName: user.username,
      source: "admin-web",
      targetType: "auth",
      targetKey: "taiko-admin",
      action: "login",
      extra: {
        status: "success",
        expiresAt: user.expiresAt
      }
    }).catch(() => undefined);
    return {
      authenticated: true,
      user
    };
  } catch (error: any) {
    await recordAdminAction({
      actorType: "anonymous",
      actorId: username,
      actorName: username,
      source: "admin-web",
      targetType: "auth",
      targetKey: "taiko-admin",
      action: "login",
      extra: {
        status: "failed",
        reason: error?.statusMessage || error?.message || "登录失败"
      }
    }).catch(() => undefined);
    throw error;
  }
};

export const logoutTaikoAdmin = async (event: H3Event) => {
  const session = await getTaikoAdminSession(event);
  clearAdminSession(event);
  if (session) {
    await recordAdminAction({
      actorType: "admin",
      actorId: String(session.user.id || ""),
      actorName: session.user.username,
      source: "admin-web",
      targetType: "auth",
      targetKey: "taiko-admin",
      action: "delete",
      extra: {
        reason: "logout"
      }
    }).catch(() => undefined);
  }
  return { ok: true };
};

export const getTaikoAdminSessionSummary = async (event: H3Event) => {
  const session = await getTaikoAdminSession(event);
  return {
    authenticated: Boolean(session),
    user: session?.user || null
  };
};
