// Slice E2: data types and pure presentation helpers of /account/sync and the shell's sync control.
// The response types were declared in pages/account/sync.vue and moved here unchanged (GET /api/account/sync/targets,
// POST /api/account/sync). The helpers only derive what to show from what the API returned; they never decide what
// the page sends (the page's handlers and the start button's disabled condition are unchanged).

export type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
  source: "wahlap" | "hiroba" | "manual";
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
  requiresReverification?: boolean;
};

export type SyncResult = {
  targetId: string;
  label: string;
  ok: boolean;
  statusCode: number;
  message: string;
  receivedBytes: number;
  decompressedBytes: number;
  songCount: number | null;
};

export type SyncLog = {
  id: number;
  taikoId: string;
  status: string;
  targetIds: string[];
  results: SyncResult[];
  originalBytes: number;
  compressedBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type ScoreTokenStatus = {
  taikoId: string;
  exists: boolean;
  tokenMask: string | null;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
} | null;

export type SyncOverviewPayload = {
  currentBinding: BindingSummary | null;
  hasUserdata: boolean;
  canSyncFromWahlap: boolean;
  scoreTokenAvailable: boolean;
  scoreToken: ScoreTokenStatus;
  targets: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  cooldownRemainingSeconds: number;
  cooldownUntil: string;
  lastSync: SyncLog | null;
};

/** A sync log's status as the page presents it. The server writes success / partial / failed ("unknown" when the
 *  row has none); everything that is not success or partial is a failure, as in the page's buildSyncFeedback. */
export type SyncOutcome = "success" | "partial" | "failed";
export const syncOutcome = (status: string | null | undefined): SyncOutcome =>
  status === "success" ? "success" : status === "partial" ? "partial" : "failed";

/**
 * Why the start button is (or is not) available, in the order the page's disabled condition checks it
 * (`pending || !currentBinding || canSyncFromWahlap === false || cooldown > 0 || !targets.length`). Manual bindings
 * have no start button at all (the target section is not rendered for them, as before).
 */
export type SyncReadiness = "unbound" | "manual" | "reverify" | "unavailable" | "cooldown" | "noTargets" | "ready";
export function syncReadiness(overview: SyncOverviewPayload, cooldown: number): SyncReadiness {
  const binding = overview.currentBinding;
  if (!binding) return "unbound";
  if (binding.isManual) return "manual";
  if (overview.canSyncFromWahlap === false) return binding.requiresReverification ? "reverify" : "unavailable";
  if (cooldown > 0) return "cooldown";
  if (!overview.targets.length) return "noTargets";
  return "ready";
}

/**
 * The shell's sync control (top bar). It shows what the sync page last read for the signed-in account and binding;
 * it never reads anything itself (no polling). null = nothing known yet: the plain control, as before.
 *   running    a sync or import request of the sync page is in flight
 *   unbound    no current binding
 *   attention  the current binding cannot sync (re-verification, or the service is not configured)
 *   never      no sync result yet (lastSync is null)
 *   failed / partial / ok   the last sync (lastSync.status)
 *   manual     a manual binding (nothing to sync)
 */
export type SyncIndicatorKind = "running" | "unbound" | "attention" | "never" | "failed" | "partial" | "ok" | "manual";
export function syncIndicatorKind(overview: SyncOverviewPayload | null | undefined, busy: boolean): SyncIndicatorKind | null {
  if (busy) return "running";
  if (!overview) return null;
  const binding = overview.currentBinding;
  if (!binding) return "unbound";
  if (binding.isManual) return "manual";
  if (overview.canSyncFromWahlap === false) return "attention";
  const log = overview.lastSync;
  if (!log) return "never";
  const outcome = syncOutcome(log.status);
  return outcome === "success" ? "ok" : outcome;
}
/** Which mark the control carries: a warning dot when the next step is the player's, a danger dot after a failure. */
export const syncIndicatorMark = (kind: SyncIndicatorKind | null): "warn" | "danger" | null =>
  kind === "failed" ? "danger" : kind === "unbound" || kind === "attention" || kind === "never" || kind === "partial" ? "warn" : null;

/** Shared between the sync page (writer) and the shell (reader); scoped to the account and binding generation. */
export type SyncIndicatorState = { userId: number; generation: number; kind: SyncIndicatorKind; settled: Exclude<SyncIndicatorKind, "running"> | null };
export const SYNC_INDICATOR_KEY = "rework-sync-indicator";
