import { getAccountDb } from '../account-db';
import { getAdminRuntimeConfig } from './shared';
import { createTrafficStore } from './traffic-store';

let store: ReturnType<typeof createTrafficStore> | undefined;
export function getViewerTrafficStore() {
  const config = useRuntimeConfig();
  return store ||= createTrafficStore(getAccountDb(), getAdminRuntimeConfig().viewerAccessLogPath,
    config.viewerPageRoutePatterns as string[]);
}
