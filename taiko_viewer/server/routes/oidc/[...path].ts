import { defineEventHandler, createError } from 'h3';
import { getViewerProvider } from '../../services/reverse-oidc/provider';
import { handleViewerInteraction } from '../../services/reverse-oidc/interaction';

export default defineEventHandler(async event => {
  const provider = getViewerProvider();
  if (!provider) throw createError({statusCode:404});
  const path = (event.node.req.url || '').split('?')[0];
  const interaction = /^\/oidc\/interaction\/([A-Za-z0-9_-]{1,255})$/.exec(path);
  if (interaction) return handleViewerInteraction(event,interaction[1]!);
  // The mounted Koa callback owns the raw Node response and form body.
  const req = event.node.req as typeof event.node.req & { originalUrl?: string };
  const original = req.url;
  const originalUrl = req.originalUrl;
  req.originalUrl = original;
  event.node.req.url = original!.slice('/oidc'.length) || '/';
  try {
    await provider.callback()(event.node.req,event.node.res);
  } finally { req.url = original; req.originalUrl = originalUrl; }
});
