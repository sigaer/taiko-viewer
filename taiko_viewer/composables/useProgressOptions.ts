import { onBeforeUnmount, ref, watch } from "vue";
import { resolveViewerError } from "~/utils/viewerError";

export interface ProgressOptions {
  dani: Array<{ version: string; grades: string[] }>;
  constants: { pass: string[]; comprehensive: string[] };
  stars: number[];
  named: string[];
  pages: { pass: Record<string, number>; comprehensive: Record<string, number>; star: Record<string, number>; named: Record<string, number> };
}

export const useProgressOptions = () => {
  // Capture all Nuxt/i18n context before any asynchronous continuation.
  const { t, locale } = useI18n();
  const apiFetch = useViewerApiFetch();
  const accountUser = useState<{ id: number } | null>("account-user", () => null);
  const bindingGeneration = useState("account-binding-generation", () => 0);
  const options = ref<ProgressOptions | null>(null);
  const optionsLoading = ref(false);
  const optionsError = ref("");
  let generation = 0;
  let controller: AbortController | null = null;
  const cancel = () => {
    generation++;
    controller?.abort();
    controller = null;
    options.value = null;
    optionsLoading.value = false;
    optionsError.value = "";
  };
  const loadOptions = async () => {
    cancel();
    if (!accountUser.value) return;
    const request = generation;
    controller = new AbortController();
    optionsLoading.value = true;
    try {
      const result = await apiFetch<ProgressOptions>("/api/account/progress/options", { credentials: "include", signal: controller.signal });
      if (request === generation) options.value = result;
    } catch (error: unknown) {
      if (request !== generation) return;
      const message = await resolveViewerError(error, locale.value === "ja" ? "進捗項目を読み込めませんでした" : "进度选项加载失败", t);
      if (request === generation) optionsError.value = message;
    } finally {
      if (request === generation) { optionsLoading.value = false; controller = null; }
    }
  };
  watch(() => [accountUser.value?.id, bindingGeneration.value], () => { cancel(); void loadOptions(); }, { flush: "sync" });
  onBeforeUnmount(cancel);
  return { options, optionsLoading, optionsError, loadOptions };
};
