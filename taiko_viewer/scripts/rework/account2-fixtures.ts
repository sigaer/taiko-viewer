// Intercepted responses for the slice E2 self-check (同步、开发者、工单). The sync, developer and support areas are
// database-backed: every /api/account/* and /api/support/* answer used here is synthetic, typed against the response
// types the pages declare (utils/rework/sync.ts, utils/rework/developer.ts, types/support.ts, the contract's grant
// types), so a field a page reads cannot drift from what the API returns. Only used by account2-scenarios.mjs; never
// served. Every secret is obviously synthetic: tokens are "SYNTHETIC-…" strings, keys "tk_synthetic…", addresses end in
// example.invalid.
import type { DeveloperClient, ResourceGrant } from "@sakura-taiko/contract";
import type { SupportReviewDashboard, SupportTicket, SupportTicketDetail, SupportTicketMessage } from "../../types/support";
import type { DeveloperApplication, DeveloperPayload, ReviewApplication, ReviewPayload } from "../../utils/rework/developer";
import type { BindingSummary, SyncLog, SyncOverviewPayload } from "../../utils/rework/sync";

export const SYNTHETIC_SCORE_TOKEN = "SYNTHETIC-SCORE-TOKEN-0000-1111-2222-3333-4444-5555";
export const SYNTHETIC_DEVELOPER_TOKEN = "SYNTHETIC-DEV-TOKEN-000000";
export const SYNTHETIC_KINOKO_KEY = "tk_synthetic_selfcheck_key";
export const LONG = "超长文本自检".repeat(40) + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(6);

// ---------- Sync ----------
export const syncBinding = (extra: Partial<BindingSummary> = {}): BindingSummary => ({
  id: 1,
  taikoId: "100000001",
  isCurrent: true,
  verifiedTitle: "太鼓の達人",
  verifiedTitleplateId: 42,
  createdAt: "2025-04-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
  source: "wahlap",
  displayName: "鼓众自检",
  isManual: false,
  canExternalSync: true,
  requiresReverification: false,
  ...extra
});

export const syncLog = (status: "success" | "partial" | "failed" | "unknown", id = 11, extra: Partial<SyncLog> = {}): SyncLog => ({
  id,
  taikoId: "100000001",
  status,
  targetIds: ["viewer", "ourtaiko"],
  results: [
    { targetId: "viewer", label: "Viewer", ok: status !== "failed", statusCode: status === "failed" ? 502 : 200, message: status === "failed" ? "上游暂时无响应" : "ok", receivedBytes: 1200, decompressedBytes: status === "failed" ? 0 : 48213, songCount: status === "failed" ? null : 812 },
    { targetId: "ourtaiko", label: "OurTaiko", ok: status === "success", statusCode: status === "success" ? 200 : 503, message: status === "success" ? "ok" : "目标服务维护中", receivedBytes: 0, decompressedBytes: 0, songCount: null }
  ],
  originalBytes: 48213,
  compressedBytes: 9120,
  createdAt: "2026-11-18T10:20:30.000Z",
  updatedAt: "2026-11-18T10:20:40.000Z",
  ...extra
});

export type SyncVariant = "ready" | "cooldown" | "unbound" | "manual" | "reverify" | "unavailable" | "noTargets" | "never" | "partial" | "failed" | "token" | "tokenOff" | "long";
export function fixtureSyncOverview(variant: SyncVariant = "ready", extra: Partial<SyncOverviewPayload> = {}): SyncOverviewPayload {
  const current =
    variant === "unbound" ? null
    : variant === "manual" ? syncBinding({ id: 3, taikoId: "M3", source: "manual", displayName: "手动账号 自检", isManual: true, canExternalSync: false, verifiedTitle: null })
    : variant === "reverify" ? syncBinding({ requiresReverification: true })
    : variant === "long" ? syncBinding({ displayName: LONG.slice(0, 120), verifiedTitle: LONG.slice(0, 60) })
    : syncBinding();
  return {
    currentBinding: current,
    hasUserdata: variant !== "never" && variant !== "unbound",
    canSyncFromWahlap: !["manual", "reverify", "unavailable"].includes(variant) && Boolean(current),
    scoreTokenAvailable: variant !== "tokenOff",
    scoreToken:
      variant === "token" || variant === "long"
        ? { taikoId: "100000001", exists: true, tokenMask: variant === "long" ? "SYNTHETIC…" + "x".repeat(80) : "SYNTHETIC…5555", lastUsedAt: "2026-11-17T08:00:00.000Z", createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z" }
        : { taikoId: "100000001", exists: false, tokenMask: null, lastUsedAt: null, createdAt: null, updatedAt: null },
    targets:
      variant === "noTargets" ? []
      : [
          { id: "viewer", label: "Viewer", description: "写入 Viewer 的成绩与成长记录" },
          { id: "ourtaiko", label: variant === "long" ? "OurTaiko " + LONG.slice(0, 80) : "OurTaiko", description: variant === "long" ? LONG.slice(0, 200) : "推送到 OurTaiko" }
        ],
    cooldownRemainingSeconds: variant === "cooldown" ? 95 : 0,
    cooldownUntil: variant === "cooldown" ? "2026-11-18T10:50:30.000Z" : "",
    lastSync:
      variant === "never" || variant === "unbound" || variant === "manual" ? null
      : variant === "partial" ? syncLog("partial")
      : variant === "failed" ? syncLog("failed")
      : syncLog("success"),
    ...extra
  };
}

// ---------- Developer ----------
const application = (status: string, extra: Partial<DeveloperApplication> = {}): DeveloperApplication => ({
  id: 31,
  replyEmail: "developer-selfcheck@example.invalid",
  reason: "用于机厅群查分机器人。\n需要读取当前成绩。",
  imageUrls: ["/selfcheck/app-1.png"],
  status,
  reviewNote: status === "rejected" ? "用途描述不足，请补充接入场景" : "",
  reviewedAt: status === "pending" ? "" : "2026-11-10T00:00:00.000Z",
  createdAt: "2026-11-09T00:00:00.000Z",
  updatedAt: "2026-11-10T00:00:00.000Z",
  ...extra
});
export type DeveloperVariant = "none" | "pending" | "rejected" | "approved" | "approvedInactive" | "reviewer" | "long";
export function fixtureDeveloper(variant: DeveloperVariant = "none"): DeveloperPayload {
  const status = variant === "approvedInactive" || variant === "reviewer" ? "approved" : variant === "long" ? "rejected" : variant;
  const current = variant === "none" ? null : application(status, variant === "long" ? { reason: LONG, reviewNote: LONG.slice(0, 300), replyEmail: "a-very-long-reply-address-for-the-selfcheck-" + "x".repeat(40) + "@example.invalid" } : {});
  return {
    canReview: variant === "reviewer",
    currentApplication: current,
    history: current ? [current, application("rejected", { id: 30, createdAt: "2026-10-01T00:00:00.000Z" })] : [],
    token: status === "approved" ? { id: 5, tokenMask: "SYNTHETIC…0000", status: variant === "approvedInactive" ? "revoked" : "active", issuedAt: "2026-11-10T00:00:00.000Z", lastUsedAt: "2026-11-17T00:00:00.000Z", revokedAt: "" } : null
  };
}

const reviewApp = (id: number, extra: Partial<ReviewApplication> = {}): ReviewApplication => ({
  ...application("pending", { id }),
  applicant: { id: 100 + id, username: `applicant-${id}`, email: `applicant-${id}@example.invalid` },
  reviewer: null,
  ...extra
});
export function fixtureDeveloperReview(variant: "full" | "empty" = "full"): ReviewPayload {
  if (variant === "empty") return { pending: [], history: [] };
  return {
    pending: [reviewApp(41), reviewApp(42, { reason: LONG })],
    history: [reviewApp(40, { status: "approved", reviewNote: "注意调用频率" }), reviewApp(39, { status: "rejected", reviewNote: "用途不清" })]
  };
}

export type GrantsState = {
  consentVersion: string;
  audience: string;
  clients: DeveloperClient[];
  bindings: Array<{ bindingId: string; source: string; displayName: string | null }>;
  grants: ResourceGrant[];
  hasMore: { clients: boolean; bindings: boolean; grants: boolean };
  nextCursor?: string | null;
};
const grant = (grantId: string, extra: Partial<ResourceGrant> = {}): ResourceGrant => ({
  grantId,
  ownerUserId: "7001",
  bindingId: "b-1",
  playerId: "p-1",
  clientId: "c-1",
  audience: "viewer:developer-api:v1",
  scopes: ["account:read"],
  consentVersion: "2026-01",
  consentedAt: "2026-11-01T00:00:00.000Z",
  issuedAt: "2026-11-01T00:00:00.000Z",
  expiresAt: null,
  revokedAt: null,
  revision: "r1",
  ...extra
});
export function fixtureGrants(page = 0): GrantsState {
  return {
    consentVersion: "2026-01",
    audience: "viewer:developer-api:v1",
    clients: [{ clientId: "c-1", displayName: "Synthetic App", status: "active" }, { clientId: "c-2", displayName: "Synthetic Bot " + LONG.slice(0, 60), status: "active" }],
    bindings: [{ bindingId: "b-1", source: "wahlap", displayName: "鼓众自检" }],
    grants:
      page === 0
        ? [grant("g-active"), grant("g-legacy", { scopes: ["scores:read", "profile:read"], expiresAt: "2026-12-31T00:00:00.000Z" }), grant("g-revoked", { revokedAt: "2026-11-05T00:00:00.000Z" })]
        : [grant("g-old")],
    hasMore: { clients: false, bindings: false, grants: page === 0 },
    nextCursor: page === 0 ? "cursor-1" : null
  };
}
export const fixtureOwnClients = (): { clients: DeveloperClient[]; hasMore: boolean; nextCursor: string | null } => ({
  clients: [{ clientId: "c-1", displayName: "Synthetic App", status: "active" }, { clientId: "c-9", displayName: "Old App", status: "disabled" }],
  hasMore: false,
  nextCursor: null
});

// ---------- Support ----------
const message = (id: number, authorRole: SupportTicketMessage["authorRole"], content: string, createdAt: string): SupportTicketMessage => ({
  id,
  authorRole,
  authorUserId: authorRole === "staff" ? 1 : 7001,
  content,
  mailStatus: "sent",
  createdAt
});
export const supportTicket = (id: number, extra: Partial<SupportTicket> = {}): SupportTicket => ({
  id,
  title: `同步后资料没有刷新 #${id}`,
  category: "sync",
  content: "复现步骤：\n1. 同步\n2. 打开档案",
  contact: "support-selfcheck@example.invalid",
  status: "open",
  mailStatus: "sent",
  hasUnread: false,
  messageCount: 2,
  createdAt: "2026-11-15T09:00:00.000Z",
  updatedAt: "2026-11-16T09:00:00.000Z",
  ...extra
});
export function fixtureTickets(variant: "full" | "empty" = "full"): { items: SupportTicket[] } {
  if (variant === "empty") return { items: [] };
  return {
    items: [
      supportTicket(21, { hasUnread: true }),
      supportTicket(20, { status: "closed", mailStatus: "failed", category: "bug", title: LONG.slice(0, 160), content: LONG, contact: null }),
      supportTicket(19, { mailStatus: "pending", category: "feature" })
    ]
  };
}
export function fixtureTicketDetail(ticket: SupportTicket, extraMessages: SupportTicketMessage[] = []): SupportTicketDetail {
  return {
    ...ticket,
    user: { id: 7001, username: "selfcheck-account", email: "account-selfcheck@example.invalid" },
    messages: [
      message(1, "user", ticket.content, ticket.createdAt),
      message(2, "staff", "已收到，正在排查。" + (ticket.id === 20 ? LONG : ""), "2026-11-16T09:00:00.000Z"),
      ...extraMessages
    ]
  };
}
export function fixtureSupportReview(): SupportReviewDashboard {
  const user = { id: 7002, username: "ticket-user", email: "ticket-user@example.invalid" };
  return {
    pending: [{ ...supportTicket(51), hasUnread: true, user }, { ...supportTicket(52, { title: LONG.slice(0, 140) }), hasUnread: false, user }],
    history: [{ ...supportTicket(50, { status: "closed" }), hasUnread: false, user }]
  };
}
