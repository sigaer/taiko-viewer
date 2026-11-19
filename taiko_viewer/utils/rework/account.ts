// Slice E1 (account): the response types of /api/account/profile and /api/account/my-don/showcase as the profile page
// declared them (moved unchanged so the section components can share them), and the page's section list.
import type { AccountTitle } from "~/types/account-title";

export type QqBindingPayload = {
  qqNumber: string;
  status: "pending" | "active" | "removed";
  verifiedAt: string | null;
  createdAt: string;
} | null;

export type ProfileBinding = {
  id: number;
  taikoId: string;
  source: "wahlap" | "hiroba" | "manual";
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
  requiresReverification?: boolean;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfilePayload = {
  user: {
    id: number;
    username: string;
    titles?: AccountTitle[];
    email: string;
    emailVerified: boolean;
    avatarUrl: string;
    createdAt: string;
  };
  bindings: ProfileBinding[];
  currentBinding: (ProfileBinding & { currentTitle?: string | null }) | null;
  pendingBinding: {
    taikoId: string;
    originalTitle: string;
    originalTitleplateId: number;
    expiresAt: string;
  } | null;
  qqBinding: QqBindingPayload;
  verificationStatus: {
    emailVerified: boolean;
    taikoVerified: boolean;
  };
};

export type MyDonShowcaseTitleOption = {
  titleName: string;
  plateId: number;
  requirementType: string;
  difficultyScope: string;
  conditionText: string;
  songNames: string[];
  songIds: number[];
  constValue: number;
  isMultiSong: boolean;
  source: "official" | "custom";
  customTitleId: number | null;
  difficultyLevel: number | null;
  plateStyle: "silver" | "gold" | "rainbow" | null;
};

export type MyDonShowcaseLayout = "nickname" | "full" | "full_gold";

export type MyDonShowcasePayload = {
  bindingId: number | null;
  taikoId: string | null;
  hasUserdata: boolean;
  isCustom: boolean;
  layoutMode: MyDonShowcaseLayout;
  selectedTitles: string[];
  availableTitles: MyDonShowcaseTitleOption[];
};

/** Section ids of /account/profile: in-page anchors only (no URL state is written; a #hash deep link lands there). */
export const PROFILE_SECTIONS = {
  identity: "account-identity",
  bindings: "account-bindings",
  signIn: "account-sign-in",
  myDon: "account-mydon",
  apps: "account-apps"
} as const;

/** Locale key (rework.account.profile.*) of a binding's source stamp, as the page always showed it. */
export const bindingStampKey = (source: ProfileBinding["source"]) =>
  source === "manual" ? "manualStamp" : source === "hiroba" ? "jpStamp" : "cnStamp";

/** Locale keys of a showcase option's requirement and difficulty scope (same mapping as the page's former tables). */
export const showcaseRequirementKey = (type: string) =>
  type === "all_perfect" ? "all_perfect" : type === "full_combo" ? "full_combo" : "clear";
export const showcaseScopeKey = (scope: string) =>
  ["inner_oni", "oni_or_inner_oni", "oni", "hard", "normal", "easy"].includes(scope) ? scope : "any";
