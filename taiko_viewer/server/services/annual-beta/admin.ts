import type {H3Event} from 'h3';
import {createError} from 'h3';
import {requireTaikoAdminSession} from '~/server/utils/admin/auth';
import {isAnnualReportOperator} from '~/server/utils/admin/annual-report-access';
import {ensureAccountSchema,getAccountDb} from '~/server/utils/account-db';
export const requireBetaAdmin=async(event:H3Event)=>{const session=await requireTaikoAdminSession(event);if(!isAnnualReportOperator(session.user.username))throw createError({statusCode:403,statusMessage:'无年度报告管理权限'});await ensureAccountSchema();return session;};
export const betaDashboard=async()=>{
 const db=getAccountDb();
 const [funnel]:any=await db.query('SELECT event_name,COUNT(DISTINCT participant_id) AS participants,COUNT(*) AS events FROM web_beta_events GROUP BY event_name');
 const [invites]:any=await db.query(`SELECT id,cohort,recruitment_source,expires_at,max_uses,used_count,disabled_at,created_at,
 CASE WHEN disabled_at IS NOT NULL THEN 'disabled' WHEN used_count>=max_uses THEN 'redeemed' WHEN expires_at<=NOW() THEN 'expired' ELSE 'available' END AS status FROM web_beta_invites ORDER BY created_at DESC LIMIT 500`);
 const [participants]:any=await db.query(`SELECT p.*,MAX(e.occurred_at) AS last_seen,COUNT(DISTINCT e.event_name) AS event_types,
 GROUP_CONCAT(DISTINCT e.event_name) AS completed_events,MAX(a.enabled) AS entitlement_enabled,
 MAX(i.expires_at) AS invite_expires_at,MAX(i.disabled_at) AS invite_disabled_at
 FROM web_beta_participants p JOIN web_beta_events e ON e.participant_id=p.id
 LEFT JOIN web_annual_summary_access a ON a.user_id=p.user_id LEFT JOIN web_beta_invites i ON i.id=p.invite_id
 GROUP BY p.id ORDER BY (p.invite_id IS NOT NULL) DESC,last_seen DESC LIMIT 200`);
 const [times]:any=await db.query(`SELECT participant_id,event_name,MIN(occurred_at) AS first_at,MAX(occurred_at) AS last_at FROM web_beta_events GROUP BY participant_id,event_name`);
 const [feedback]:any=await db.query('SELECT id,participant_id,kind,category,summary_id,context_json,answers_json,created_at FROM web_beta_feedback ORDER BY created_at DESC LIMIT 200');
 const [activation]:any=await db.query(`SELECT COUNT(*) AS eligible,SUM(p.hint_level<3 AND (SELECT COUNT(DISTINCT e.event_name) FROM web_beta_events e WHERE e.participant_id=p.id AND e.event_name IN ('auth_success','beta_invite_redeemed','binding_success','data_sync_success','annual_report_open'))=5) AS activated FROM web_beta_participants p WHERE p.invite_id IS NOT NULL AND EXISTS(SELECT 1 FROM web_beta_events e WHERE e.participant_id=p.id AND e.event_name='annual_entry_click' AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.source'))='home_hero')`);
 return {funnel,invites,participants,times,feedback,activation:activation[0]};
};
