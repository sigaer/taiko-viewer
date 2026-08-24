export type HomeState =
  | "guest"
  | "authenticated_unbound"
  | "authenticated_bound_empty"
  | "authenticated_ready";

export type HomeResolverStage = "auth" | "binding" | "scores";

export type HomeResolverStatus = "loading" | "ready" | "error";

export type HomeBinding = {
  id: number;
  taikoId: string;
  source: "wahlap" | "hiroba" | "manual";
  isCurrent?: boolean;
};

export type HomeScoreItem = Record<string, unknown>;

export type HomeAuthPayload = {
  authenticated: boolean;
  user: Record<string, unknown> | null;
};

export type HomeBindingPayload = {
  bindings: HomeBinding[];
  currentBinding: HomeBinding | null;
};

export type HomeScoresPayload = {
  total: number;
  items: HomeScoreItem[];
};

export type HomeStateResolution = {
  homeState: HomeState;
  authenticated: boolean;
  currentBinding: HomeBinding | null;
  hasScores: boolean;
};

export type HomeResolverErrorInfo = {
  stage: HomeResolverStage;
  message: string;
};

export class HomeStateResolverError extends Error {
  readonly stage: HomeResolverStage;
  readonly causeValue: unknown;

  constructor(stage: HomeResolverStage, causeValue: unknown) {
    super(`${stage} request failed`);
    this.name = "HomeStateResolverError";
    this.stage = stage;
    this.causeValue = causeValue;
  }
}

export type HomeStateRequests = {
  auth: () => Promise<HomeAuthPayload>;
  binding: () => Promise<HomeBindingPayload>;
  scores: () => Promise<HomeScoresPayload>;
};

const BINDING_SOURCES = new Set<HomeBinding["source"]>(["wahlap", "hiroba", "manual"]);

const scoreFields = [
  "highScore",
  "bestScoreRank",
  "goodCnt",
  "okCnt",
  "ngCnt",
  "poundCnt",
  "stageCnt",
  "clearCnt",
  "fullComboCnt",
  "dondafulComboCnt",
  "comboCnt",
  "high_score",
  "best_score_rank",
  "good_cnt",
  "ok_cnt",
  "ng_cnt",
  "pound_cnt",
  "stage_cnt",
  "clear_cnt",
  "full_combo_cnt",
  "dondaful_combo_cnt",
  "combo_cnt"
] as const;

const isPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
};

export const hasEffectiveScoreRecord = (item: HomeScoreItem) =>
  scoreFields.some((field) => isPositiveNumber(item[field]));

const isValidBinding = (binding: HomeBinding | null): binding is HomeBinding => {
  if (!binding || !Number.isInteger(Number(binding.id)) || Number(binding.id) <= 0) return false;
  if (!String(binding.taikoId || "").trim()) return false;
  return BINDING_SOURCES.has(binding.source);
};

const runRequest = async <T>(stage: HomeResolverStage, request: () => Promise<T>) => {
  try {
    return await request();
  } catch (error) {
    throw new HomeStateResolverError(stage, error);
  }
};

export const resolveHomeState = async (requests: HomeStateRequests): Promise<HomeStateResolution> => {
  const auth = await runRequest("auth", requests.auth);

  if (!auth || typeof auth !== "object") {
    throw new HomeStateResolverError("auth", new Error("invalid auth response"));
  }

  if (!auth.authenticated && !auth.user) {
    return {
      homeState: "guest",
      authenticated: false,
      currentBinding: null,
      hasScores: false
    };
  }

  if (!auth.authenticated || !auth.user) {
    throw new HomeStateResolverError("auth", new Error("inconsistent auth response"));
  }

  const bindingPayload = await runRequest("binding", requests.binding);
  if (!bindingPayload || !Array.isArray(bindingPayload.bindings) || !("currentBinding" in bindingPayload)) {
    throw new HomeStateResolverError("binding", new Error("invalid binding response"));
  }

  const currentBinding = bindingPayload.currentBinding;
  if (currentBinding === null) {
    return {
      homeState: "authenticated_unbound",
      authenticated: true,
      currentBinding: null,
      hasScores: false
    };
  }

  if (!isValidBinding(currentBinding)) {
    throw new HomeStateResolverError("binding", new Error("invalid current binding"));
  }

  const scores = await runRequest("scores", requests.scores);
  if (!scores || !Array.isArray(scores.items) || !Number.isFinite(Number(scores.total))) {
    throw new HomeStateResolverError("scores", new Error("invalid scores response"));
  }

  const hasScores = Number(scores.total) > 0 && scores.items.some(hasEffectiveScoreRecord);
  return {
    homeState: hasScores ? "authenticated_ready" : "authenticated_bound_empty",
    authenticated: true,
    currentBinding,
    hasScores
  };
};

export const getHomeResolverErrorInfo = (error: unknown): HomeResolverErrorInfo => {
  if (error instanceof HomeStateResolverError) {
    const causeMessage = error.causeValue instanceof Error ? error.causeValue.message : "请求失败";
    return { stage: error.stage, message: causeMessage || "请求失败" };
  }
  return { stage: "auth", message: error instanceof Error ? error.message : "请求失败" };
};
