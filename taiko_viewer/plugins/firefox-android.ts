import { FIREFOX_ANDROID_BOOTSTRAP, isFirefoxAndroid } from "~/utils/firefox-android.mjs";
import { installFirefoxScrollRestoration } from "~/utils/firefox-scroll-restoration";

export default defineNuxtPlugin({
  name: "firefox-android-shell",
  enforce: "pre",
  dependsOn: ["nuxt:router"],
  setup(nuxtApp) {
    // Runs in <head> before the SSR body is painted. html is outside Vue's
    // hydration root; the rendered component tree is identical for every UA.
    useHead({ script: [{ key: "firefox-android-bootstrap", tagPosition: "head", tagPriority: "critical", innerHTML: FIREFOX_ANDROID_BOOTSTRAP }] });
    if (!import.meta.client || !isFirefoxAndroid(navigator.userAgent)) return;
    useHead({ htmlAttrs: { class: "firefox-android" } });
    const router = useRouter();
    let dispose: (() => void) | undefined;
    const removeMounted = nuxtApp.hook("app:mounted", () => { dispose = installFirefoxScrollRestoration(router); });
    const cleanup = () => { removeMounted(); dispose?.(); };
    nuxtApp.vueApp.onUnmount(cleanup);
    if (import.meta.hot) import.meta.hot.dispose(cleanup);
  }
});
