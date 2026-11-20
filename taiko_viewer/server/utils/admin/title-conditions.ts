import type { TitleCatalogItem } from '../../../types/content.ts';
import { createTitleConditionManager } from '../../services/admin-title-conditions.ts';
import { getOfficialTitlesContent } from '../../services/content/titles.ts';
import { getLocalTitleDetails } from '../../services/content/titleDetails.ts';
import { fetchTaikoAdminResult } from './auth';
import { recordAdminAction } from './audit';
import { getAdminRuntimeConfig } from './shared';

// The request token is captured only for this request's API calls, never cached globally.
export const titleConditionManager = (token: string) => createTitleConditionManager({
  official: getOfficialTitlesContent,
  local: () => getLocalTitleDetails(getAdminRuntimeConfig().taikoAdminApiBase),
  get: (id) => fetchTaikoAdminResult<TitleCatalogItem>('/taiko/title/get', { query: { id }, token, timeout: 10_000, retry: 0 }),
  update: (id, condition) => fetchTaikoAdminResult('/taiko/manage/title/update', { method: 'PUT', body: { id, condition }, token, timeout: 10_000, retry: 0 }),
  add: (row) => fetchTaikoAdminResult('/taiko/manage/title/add', { method: 'POST', body: row, token, timeout: 10_000, retry: 0 }),
  audit: (actor, before, after) => recordAdminAction({
    actorType: 'admin', actorId: String(actor.id), actorName: actor.username, source: 'admin-web',
    targetType: 'title-condition', targetKey: String((after as TitleCatalogItem).id), action: before ? 'update' : 'create', before, after
  })
});
