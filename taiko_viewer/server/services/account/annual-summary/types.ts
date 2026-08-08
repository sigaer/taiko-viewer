import type {
  AnnualDataModeV4,
  AnnualMetricStatusV4,
  AnnualObservationEventV4,
  AnnualSummaryV4Generated,
  AnnualTimePrecisionV4
} from "~/types/annual-summary-v4.generated";

export type AnnualLocale = "zh" | "ja";
export type AnnualDataMode = AnnualDataModeV4;
export type AnnualMetricStatus = AnnualMetricStatusV4;
export type AnnualTimePrecision = AnnualTimePrecisionV4;

export type AnnualVersion = {
  key: "annual_2026";
  name: string;
  startDate: string;
  endDate: string;
  effectiveEndDate: string;
  isOngoing: false;
  timezone: "Asia/Shanghai";
};

export type AnnualObservationEvent = AnnualObservationEventV4 & {
  [key: string]: unknown;
};

export type AnnualSummaryV4 = AnnualSummaryV4Generated & {
  version: AnnualVersion | Record<string, unknown>;
  timeCoverage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AnnualCliEnvelope = {
  summary: AnnualSummaryV4;
  events: AnnualObservationEvent[];
};

export type AnnualSummaryRow = {
  id: string;
  user_id: number;
  binding_id: number;
  version_key: string;
  schema_version: number;
  data_mode: AnnualDataMode;
  input_fingerprint: string;
  summary_path: string;
  events_path: string;
  event_count: number;
  generated_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type AnnualJobType = "build" | "poster";
export type AnnualJobStatus = "queued" | "running" | "completed" | "failed";

export type AnnualJobRow = {
  id: string;
  user_id: number;
  binding_id: number;
  version_key: string;
  job_type: AnnualJobType;
  status: AnnualJobStatus;
  summary_id: string | null;
  poster_id: string | null;
  parameters_json: string | null;
  error_code: string | null;
  error_message: string | null;
  progress_stage: string;
  progress_percent: number;
  progress_detail: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type AnnualShareRow = {
  id: string;
  summary_id: string;
  user_id: number;
  locale: AnnualLocale;
  token_hash: string;
  status: "active" | "revoked" | "expired";
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type AnnualPosterRow = {
  id: string;
  summary_id: string;
  share_id: string;
  user_id: number;
  locale: AnnualLocale;
  fingerprint: string;
  file_path: string;
  width: number;
  height: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type AnnualJobParameters = {
  locale?: AnnualLocale;
  shareId?: string;
};
