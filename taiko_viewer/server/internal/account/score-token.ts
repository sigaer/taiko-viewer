import { createError } from "h3";
import { readBoundedGatewayJson } from "../../infrastructure/local-gateway/json.ts";

import type { ScoreTokenStatus } from "../../infrastructure/account/score-token.ts";
export type { ScoreTokenStatus } from "../../infrastructure/account/score-token.ts";

type ScoreTokenGatewayResponse = {
  ok?: boolean;
  token?: string;
  revoked?: boolean;
  status?: {
    taiko_id?: string;
    exists?: boolean;
    token_mask?: string | null;
    last_used_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  message?: string;
  statusMessage?: string;
};

const getScoreTokenGatewayUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  const base = (
    String(runtimeConfig.localSyncReceiverBaseUrl || process.env.TAIKO_LOCAL_SYNC_RECEIVER_BASE_URL || "").trim() ||
    "http://127.0.0.1:3102"
  ).replace(/\/+$/, "");
  return `${base}/score-token`;
};

const normalizeStatus = (payload: ScoreTokenGatewayResponse["status"], taikoId: string): ScoreTokenStatus => ({
  taikoId,
  exists: Boolean(payload?.exists),
  tokenMask: payload?.token_mask ? String(payload.token_mask) : null,
  lastUsedAt: payload?.last_used_at ? String(payload.last_used_at) : null,
  createdAt: payload?.created_at ? String(payload.created_at) : null,
  updatedAt: payload?.updated_at ? String(payload.updated_at) : null
});

// Retained compatibility adapter for frozen rollback tests. Current Viewer
// authority/status paths use the captured SQL connection instead of this gateway.
export const requestScoreTokenManagement = async (
  taikoId: string,
  action: "status" | "issue" | "revoke"
) => {
  let response: Response;
  try {
    response = await fetch(getScoreTokenGatewayUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ userid: taikoId, action }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "网页成绩 token 服务暂时不可用" });
  }

  const payload = (await readBoundedGatewayJson(response).catch(() => null)) as ScoreTokenGatewayResponse | null;
  if (!response.ok || payload?.ok !== true) {
    throw createError({
      statusCode: response.status >= 400 && response.status <= 599 ? response.status : 502,
      statusMessage: "网页成绩 token 操作失败"
    });
  }
  const status = payload.status;
  const validText = (value: unknown) => value == null || (typeof value === "string" && value.length <= 128);
  if (!status || typeof status.taiko_id !== "string" || status.taiko_id.trim() !== taikoId ||
      typeof status.exists !== "boolean" || ![status.token_mask, status.last_used_at, status.created_at, status.updated_at].every(validText) ||
      (typeof status.token_mask === "string" && status.token_mask.length > 32) ||
      (action === "issue" && (typeof payload.token !== "string" || !/^[a-f0-9]{48}$/.test(payload.token))) ||
      (action === "revoke" && typeof payload.revoked !== "boolean")) {
    throw createError({ statusCode: 502, statusMessage: "网页成绩 token 操作失败" });
  }
  return {
    token: action === "issue" ? payload.token! : null,
    revoked: action === "revoke" && payload.revoked === true,
    status: normalizeStatus(status, taikoId)
  };
};
