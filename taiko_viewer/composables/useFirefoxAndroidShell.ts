import { isFirefoxAndroid } from "~/utils/firefox-android.mjs";

// Start false on both SSR and hydration; Teleport moves only after mount.
// KeepAlive must detach a cached thread's composer when that thread is inactive.
export function useFirefoxAndroidShell() {
  const active = ref(false);
  let media: MediaQueryList | undefined;
  const update = () => { active.value = Boolean(media?.matches); };
  onMounted(() => {
    if (!isFirefoxAndroid(navigator.userAgent)) return;
    media = window.matchMedia("(max-width: 767px)");
    media.addEventListener("change", update);
    update();
  });
  onActivated(update);
  onDeactivated(() => { active.value = false; });
  onBeforeUnmount(() => media?.removeEventListener("change", update));
  return readonly(active);
}
