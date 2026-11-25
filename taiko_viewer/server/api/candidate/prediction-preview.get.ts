import { createError, getQuery, setHeader } from 'h3';
import { syntheticPredictionPreview, type PreviewState } from '../../services/prediction-evidence/preview';
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
  if (useRuntimeConfig().predictionComparisonCandidate !== true) throw createError({ statusCode: 404 });
  const query = getQuery(event);
  if (Object.keys(query).some(key => key !== 'state') || (query.state !== undefined && !['available', 'missing', 'sparse', 'revision'].includes(String(query.state)))) throw createError({ statusCode: 400 });
  return syntheticPredictionPreview((query.state || 'available') as PreviewState);
});
