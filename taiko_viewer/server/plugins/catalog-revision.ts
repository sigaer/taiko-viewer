import { withCatalogRequest } from '../services/content/catalogAuthority.ts';

export default defineNitroPlugin(app => {
  const handler = app.h3App.handler;
  app.h3App.handler = event => withCatalogRequest(() => handler(event), report => {
    setResponseHeader(event, 'X-Catalog-Revision', report.catalogRevision);
    setResponseHeader(event, 'X-Catalog-Policy-Version', report.policyVersion);
    setResponseHeader(event, 'X-Catalog-State', report.state);
  });
});
