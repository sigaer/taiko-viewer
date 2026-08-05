import { createError } from "h3";

export type ScoreTokenStatus = {
  taikoId: string;
  exists: boolean;
  tokenMask: string | null;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

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
  taikoId: String(payload?.taiko_id || taikoId).trim(),
  exists: Boolean(payload?.exists),
  tokenMask: payload?.token_mask ? String(payload.token_mask) : null,
  lastUsedAt: payload?.last_used_at ? String(payload.last_used_at) : null,
  createdAt: payload?.created_at ? String(payload.created_at) : null,
  updatedAt: payload?.updated_at ? String(payload.updated_at) : null
});

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
      body: JSON.stringify({ userid: taikoId, action })
    });
  } catch (error) {
    console.error("[score-token] 无法连接 Sakura bot token 管理网关", error);
    throw createError({ statusCode: 502, statusMessage: "网页成绩 token 服务暂时不可用" });
  }

  const payload = (await response.json().catch(() => null)) as ScoreTokenGatewayResponse | null;
  if (!response.ok || !payload?.ok) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage: String(payload?.message || payload?.statusMessage || "网页成绩 token 操作失败")
    });
  }
  return {
    token: payload.token ? String(payload.token) : null,
    revoked: Boolean(payload.revoked),
    status: normalizeStatus(payload.status, taikoId)
  };
};
