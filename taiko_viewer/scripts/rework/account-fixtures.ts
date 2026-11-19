// Intercepted responses for the slice E1 self-check (账号: sign-in, registration, recovery, profile, settings). The
// account area is database-backed: every /api/account/* answer used here is synthetic, typed against the response
// types the pages declare (utils/rework/account.ts, composables/useAccountAuthStatus.ts), so a field a page reads
// cannot drift from what the API returns. Only used by account-scenarios.mjs; never served. No real credential:
// passwords are generated per run by the scenarios; identifiers end in example.invalid.
import type { AccountAuthUser } from "../../composables/useAccountAuthStatus";
import type { MyDonShowcasePayload, ProfileBinding, ProfilePayload } from "../../utils/rework/account";

export const AVATAR_OK = "/selfcheck/avatar-ok.png";
export const MYDON_PATH = "/api/account/my-don";

export const accountUser = (extra: Partial<AccountAuthUser> = {}): AccountAuthUser => ({
  id: 7001,
  username: "selfcheck-account",
  email: "account-selfcheck@example.invalid",
  emailVerified: true,
  avatarUrl: AVATAR_OK,
  createdAt: "2025-03-04T05:06:07.000Z",
  titles: [{ key: "annual-beta-pioneer", name: "虹光先行者", style: "rainbow" as const }],
  annualSummaryAccess: false,
  myTaikoReadModelAccess: false,
  developerApiV1Access: true,
  ...extra
});

const binding = (id: number, source: ProfileBinding["source"], extra: Partial<ProfileBinding> = {}): ProfileBinding => ({
  id,
  taikoId: source === "manual" ? `M${id}` : String(100000000 + id),
  source,
  displayName: source === "manual" ? "手动账号 自检" : source === "hiroba" ? "ドンだー自検" : "鼓众自检",
  isManual: source === "manual",
  canExternalSync: source !== "manual",
  requiresReverification: false,
  isCurrent: false,
  verifiedTitle: source === "manual" ? null : "太鼓の達人",
  verifiedTitleplateId: source === "manual" ? null : 42,
  createdAt: "2025-04-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
  ...extra
});

export type ProfileVariant = "full" | "unbound" | "single" | "qq-active" | "qq-none" | "reverify";

/** The whole profile: three bindings (CN current, JP, manual), a pending challenge, a pending QQ binding. */
export function fixtureProfile(variant: ProfileVariant = "full", user: AccountAuthUser = accountUser()): ProfilePayload {
  const current = binding(1, "wahlap", { isCurrent: true, requiresReverification: variant === "reverify" });
  const bindings =
    variant === "unbound" ? [] : variant === "single" ? [current] : [current, binding(2, "hiroba"), binding(3, "manual")];
  return {
    user: { id: user.id, username: user.username, titles: user.titles, email: user.email, emailVerified: user.emailVerified, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
    bindings,
    currentBinding: bindings.length ? { ...current, currentTitle: "太鼓の達人" } : null,
    pendingBinding: variant === "full" ? { taikoId: "123456789012", originalTitle: "", originalTitleplateId: 3, expiresAt: "2026-11-18T12:00:00.000Z" } : null,
    qqBinding:
      variant === "qq-active" ? { qqNumber: "10001", status: "active", verifiedAt: "2025-06-01T00:00:00.000Z", createdAt: "2025-06-01T00:00:00.000Z" }
      : variant === "qq-none" || variant === "unbound" ? null
      : { qqNumber: "10002", status: "pending", verifiedAt: null, createdAt: "2025-06-02T00:00:00.000Z" },
    verificationStatus: { emailVerified: user.emailVerified, taikoVerified: bindings.length > 0 }
  };
}

export function fixtureShowcase(hasUserdata = true): MyDonShowcasePayload {
  return {
    bindingId: 1,
    taikoId: "100000001",
    hasUserdata,
    isCustom: false,
    layoutMode: "nickname",
    selectedTitles: ["红"],
    availableTitles: [
      { titleName: "红", plateId: 1, requirementType: "full_combo", difficultyScope: "oni", conditionText: "", songNames: [], songIds: [], constValue: 9.5, isMultiSong: false, source: "official", customTitleId: null, difficultyLevel: 4, plateStyle: null },
      { titleName: "蓝", plateId: 2, requirementType: "all_perfect", difficultyScope: "inner_oni", conditionText: "", songNames: [], songIds: [], constValue: 0, isMultiSong: false, source: "official", customTitleId: null, difficultyLevel: 5, plateStyle: null },
      { titleName: "自定义称号", plateId: 0, requirementType: "clear", difficultyScope: "any", conditionText: "", songNames: ["曲A", "曲B"], songIds: [1, 2], constValue: 8.1, isMultiSong: true, source: "custom", customTitleId: 7, difficultyLevel: null, plateStyle: "gold" }
    ]
  };
}

export type OidcProvider = { id: string; label: string; recoveryAvailable?: boolean; recoveryConflict?: boolean; linked?: boolean; remoteLinkEnabled?: boolean; remoteLinkStatus?: string; remoteLinkError?: string | null; remoteLinkUnknown?: boolean };
/** /api/account/oidc/bindings: a linked OurTaiko account whose remote link is unknown (retry offered). */
export const fixtureOidcBindings = (state: "unlinked" | "unknown" | "linked" = "unknown"): { providers: OidcProvider[] } => ({
  providers: [
    state === "unlinked"
      ? { id: "mock", label: "Synthetic OIDC", linked: false, remoteLinkEnabled: false, remoteLinkStatus: "not_requested", remoteLinkError: null }
      : { id: "mock", label: "Synthetic OIDC", linked: true, remoteLinkEnabled: true, remoteLinkStatus: state === "linked" ? "linked" : "pending", remoteLinkError: null, remoteLinkUnknown: state === "unknown" }
  ]
});
