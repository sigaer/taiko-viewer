import type { H3Event } from 'h3';
import { createError } from 'h3';
import { requireTaikoAdminSession } from '~/server/utils/admin/auth';
import { isAnnualReportOperator } from '~/server/utils/admin/annual-report-access';
import { ensureAccountSchema, getAccountDb } from '~/server/utils/account-db';
import { betaParticipantAnalysisFilter } from './analysis';

export const requireBetaAdmin = async (event: H3Event) => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: '无年度报告管理权限' });
  await ensureAccountSchema();
  return session;
};

export const betaDashboard = async (includeInternal = false) => {
  const db = getAccountDb();
  const eligible = betaParticipantAnalysisFilter();
  const filter = includeInternal ? '1=1' : eligible;
  const [funnel]: any = await db.query(`SELECT e.event_name,COUNT(DISTINCT e.participant_id) AS participants,COUNT(*) AS events
    FROM web_beta_events e JOIN web_beta_participants p ON p.id=e.participant_id
    WHERE ${filter} GROUP BY e.event_name`);
  const [invites]: any = await db.query(`SELECT id,cohort,recruitment_source,expires_at,max_uses,used_count,disabled_at,created_at,analysis_excluded,
    CASE WHEN disabled_at IS NOT NULL THEN 'disabled' WHEN used_count>=max_uses THEN 'redeemed'
    WHEN expires_at<=NOW() THEN 'expired' ELSE 'available' END AS status
    FROM web_beta_invites WHERE ${includeInternal ? '1=1' : 'analysis_excluded=0'} ORDER BY created_at DESC LIMIT 500`);
  const [participants]: any = await db.query(`SELECT p.*,NOT (${eligible}) AS analysis_excluded_effective,
    MAX(e.occurred_at) AS last_seen,COUNT(DISTINCT e.event_name) AS event_types,
    GROUP_CONCAT(DISTINCT e.event_name) AS completed_events,MAX(a.enabled) AS entitlement_enabled,
    MAX(i.expires_at) AS invite_expires_at,MAX(i.disabled_at) AS invite_disabled_at
    FROM web_beta_participants p JOIN web_beta_events e ON e.participant_id=p.id
    LEFT JOIN web_annual_summary_access a ON a.user_id=p.user_id LEFT JOIN web_beta_invites i ON i.id=p.invite_id
    WHERE ${filter} GROUP BY p.id ORDER BY (p.invite_id IS NOT NULL) DESC,last_seen DESC LIMIT 200`);
  const [times]: any = await db.query(`SELECT e.participant_id,e.event_name,MIN(e.occurred_at) AS first_at,MAX(e.occurred_at) AS last_at
    FROM web_beta_events e JOIN web_beta_participants p ON p.id=e.participant_id
    WHERE ${filter} GROUP BY e.participant_id,e.event_name`);
  const [feedback]: any = await db.query(`SELECT f.id,f.participant_id,f.kind,f.category,f.summary_id,f.context_json,f.answers_json,f.created_at
    FROM web_beta_feedback f JOIN web_beta_participants p ON p.id=f.participant_id
    WHERE ${filter} ORDER BY f.created_at DESC LIMIT 200`);
  const [activation]: any = await db.query(`SELECT COUNT(*) AS eligible,
    SUM(p.hint_level<3 AND (SELECT COUNT(DISTINCT e.event_name) FROM web_beta_events e WHERE e.participant_id=p.id
    AND e.event_name IN ('auth_success','beta_invite_redeemed','binding_success','data_sync_success','annual_report_open'))=5) AS activated
    FROM web_beta_participants p WHERE ${filter} AND p.invite_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM web_beta_events e WHERE e.participant_id=p.id AND e.event_name='annual_entry_click'
    AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.source'))='home_hero')`);
  // Consumption survives later expiry/disable; count owners from grants rather
  // than retry telemetry or the paginated participant list.
  const [inviteTotals]: any = await db.query(`SELECT
    (SELECT COUNT(*) FROM web_beta_invites WHERE used_count>0
      AND ${includeInternal ? '1=1' : 'analysis_excluded=0'}) AS consumedInvites,
    (SELECT COUNT(DISTINCT a.user_id)
    FROM web_annual_summary_access a JOIN web_beta_invites i ON i.id=a.invite_id
    LEFT JOIN web_beta_participants p ON p.user_id=a.user_id
    WHERE a.feature='annual_first_run_beta'
    AND ${includeInternal ? '1=1' : `i.analysis_excluded=0 AND (p.id IS NULL OR (${eligible}))`}) AS entitledUsers`);
  return { analysisMode: includeInternal ? 'operational' : 'beta', funnel, invites, participants, times, feedback,
    activation: activation[0], inviteTotals: inviteTotals[0] };
};
