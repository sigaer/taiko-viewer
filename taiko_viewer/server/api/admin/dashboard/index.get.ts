import { getAdminDashboardPayload } from "~/server/utils/admin/dashboard";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";
import { setHeader } from 'h3';
import { performance } from 'node:perf_hooks';

export default defineEventHandler(async (event) => {
  const started = performance.now();
  const session = await requireTaikoAdminSession(event);
  const authenticated = performance.now();
  const payload = await getAdminDashboardPayload();
  const loaded = performance.now();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "dashboard",
    targetKey: "overview",
    action: "read"
  }).catch(() => undefined);
  setHeader(event, 'server-timing', [
    `identity;dur=${(authenticated - started).toFixed(1)}`,
    `statistics;dur=${(loaded - authenticated).toFixed(1)}`,
    `audit;dur=${(performance.now() - loaded).toFixed(1)}`
  ].join(', '));
  return payload;
});
