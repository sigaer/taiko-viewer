// Copied into plugins ONLY in isolated acceptance builds; never shipped.
export default defineNuxtPlugin(nuxt => {
  const counts: Record<string, Record<string, number>> = {};
  const routes: { path: string; at: number; event: string }[] = [];
  const count = (vm: any, event: string) => {
    const name = vm.$options.name || vm.$options.__name || 'anonymous';
    const row = counts[name] ||= {};
    row[event] = (row[event] || 0) + 1;
  };
  nuxt.vueApp.mixin({
    mounted() { count(this, 'mount'); }, unmounted() { count(this, 'unmount'); },
    activated() { count(this, 'activate'); }, deactivated() { count(this, 'deactivate'); }
  });
  nuxt.$router.afterEach(to => { routes.push({ path: to.fullPath, at: performance.now(), event: 'router' }); });
  nuxt.hook('page:finish', () => { routes.push({ path: nuxt.$router.currentRoute.value.fullPath, at: performance.now(), event: 'page' }); });
  (window as any).__navQA = {
    snapshot: () => ({ counts, routes, asyncKeys: Object.keys(nuxt._asyncData).length, payloadKeys: Object.keys(nuxt.payload.data).length,
      reads: Object.fromEntries(Object.entries(nuxt._asyncData).filter(([key]) => /^(growth-|account-song)/.test(key)).map(([key, read]: [string, any]) => [key, { status: read.status.value, context: read.data.value?.context || read.data.value?.identity, profileId: read.data.value?.payload?.profileId }])) }),
    state: (key: string, value: unknown) => { nuxt.payload.state['$s' + key] = value; },
    refresh: (prefix: string) => nuxt._asyncData[Object.keys(nuxt._asyncData).find(key => key.startsWith(prefix))!].execute(),
    navigate: (path: string) => nuxt.$router.push(path)
  };
});
