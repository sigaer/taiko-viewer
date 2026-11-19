import { computed, onActivated, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { isLibraryPath, libraryReturnTarget } from "~/utils/rework/catalog";

// Last song library location in this tab (memory plus sessionStorage). Client only: the server and the
// hydration render always use the fallback, the remembered target is applied after mount.
const STORAGE_KEY = "viewer:library-return";
let memory: string | null = null;

export function rememberLibraryLocation(fullPath: string) {
  if (!import.meta.client || !isLibraryPath(fullPath)) return;
  memory = fullPath;
  try {
    sessionStorage.setItem(STORAGE_KEY, fullPath);
  } catch {
    // storage unavailable (private mode, quota): memory still covers this tab's session
  }
}

function readLibraryLocation(): string | null {
  if (memory) return memory;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Localized library location to return to; `fallback` must already be localized. */
export function useLibraryReturn(fallback: MaybeRefOrGetter<string>) {
  const { locale } = useI18n();
  const route = useRoute();
  const mounted = ref(false);
  const stored = ref<string | null>(null);
  const read = () => {
    stored.value = readLibraryLocation();
  };
  onMounted(() => {
    mounted.value = true;
    read();
  });
  onActivated(read);
  watch(
    () => route.fullPath,
    () => {
      if (mounted.value) read();
    }
  );
  return computed(() => (mounted.value && libraryReturnTarget(stored.value, locale.value)) || toValue(fallback));
}
