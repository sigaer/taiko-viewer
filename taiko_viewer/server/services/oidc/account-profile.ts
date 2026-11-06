import { normalizeEmail } from "../../internal/account/shared";

/** Identity is always proved by OIDC. Email has its own explicit provenance. */
export type AccountEmailProfile = {
  source: "oidc_id_token" | "ourtaiko_external_lookup";
  email: string;
  emailVerified: boolean;
  externalId?: string | null;
};

export const profileFromIdToken = (claims: Record<string, unknown>): AccountEmailProfile => ({
  source: "oidc_id_token",
  email: typeof claims.email === "string" ? normalizeEmail(claims.email) : "",
  emailVerified: claims.email_verified === true
});
