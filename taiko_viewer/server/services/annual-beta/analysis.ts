// T3 is a hint, not an internal-account flag. Real T3 testers stay in the
// discovery/binding funnel, but cannot count as self-service activation.
export const betaParticipantAnalysisFilter = (alias = "p") =>
  `${alias}.analysis_excluded = 0 AND NOT EXISTS (
    SELECT 1 FROM web_annual_summary_access internal_access
    WHERE internal_access.user_id = ${alias}.user_id AND internal_access.invite_id IS NULL
  )`;
