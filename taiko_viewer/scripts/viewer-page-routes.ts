import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pageRoutePattern } from '../server/utils/admin/traffic-rules';

export function viewerPageRoutes(root: string, prefix = ''): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return viewerPageRoutes(root, path);
    return entry.name.endsWith('.vue') ? [pageRoutePattern(path)] : [];
  });
}
