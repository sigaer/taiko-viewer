import { captureCatalogAuthority } from '../../services/content/catalogAuthority';
import { enforceTaikoOpenQuota } from '../../utils/taiko-open';

export default defineEventHandler(async event => {
  await enforceTaikoOpenQuota(event, 'taiko_catalog');
  const { data, body } = await captureCatalogAuthority();
  const requested = getQuery(event).revision;
  if (requested && requested !== data.catalogRevision) throw createError({ statusCode: 409, statusMessage: 'Catalog revision changed; refresh manifest' });
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, no-transform');
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');
  return body;
});
