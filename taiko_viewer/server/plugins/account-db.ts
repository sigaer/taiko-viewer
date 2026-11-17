// Shared account lifecycle formerly lived in the retired Annual startup plugin.
import { assertAccountDbConfiguration, closeAccountDb } from '../utils/account-db';

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('close', closeAccountDb);
  if (!import.meta.prerender) assertAccountDbConfiguration();
});
