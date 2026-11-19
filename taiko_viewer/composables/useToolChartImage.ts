import { onBeforeUnmount, ref, watch } from "vue";
import { resolveViewerError } from "~/utils/viewerError";

export const useToolChartImage = () => {
  const { t, locale } = useI18n();
  const imageUrl = ref("");
  const loading = ref(false);
  const errorMessage = ref("");
  // HTTP status of the last failure (0: none / unknown): lets a page tell "no bound ID" and "no data yet" apart.
  const errorStatus = ref(0);
  const accountUser = useState<{ id: number } | null>("account-user", () => null);
  const bindingGeneration = useState("account-binding-generation", () => 0);
  let generation = 0;
  let controller: AbortController | null = null;

  const revokeUrl = () => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = "";
    }
  };

  const loadChart = async (path: string, query?: Record<string, string | number | boolean | undefined>) => {
    const request = ++generation;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    errorMessage.value = "";
    errorStatus.value = 0;
    revokeUrl();
    try {
      const params = new URLSearchParams();
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            params.set(key, String(value));
          }
        });
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const blob = await $fetch<Blob>(`${path}${suffix}`, {
        responseType: "blob",
        credentials: "include",
        signal: controller.signal
      });
      if (request !== generation) return;
      imageUrl.value = URL.createObjectURL(blob);
    } catch (error: unknown) {
      if (request !== generation) return;
      const failed = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } } | null;
      const status = Number(failed?.statusCode ?? failed?.status ?? failed?.response?.status) || 0;
      const message = await resolveViewerError(error, locale.value === "ja" ? "画像を生成できませんでした。再試行してください" : "图表生成失败，请重试", t);
      if (request === generation) {
        errorMessage.value = message;
        errorStatus.value = status;
      }
    } finally {
      if (request === generation) {
        controller = null;
        loading.value = false;
      }
    }
  };

  const invalidate = () => {
    generation++;
    controller?.abort();
    controller = null;
    loading.value = false;
    errorMessage.value = "";
    errorStatus.value = 0;
    revokeUrl();
  };
  watch(() => [accountUser.value?.id, bindingGeneration.value], invalidate, { flush: "sync" });
  onBeforeUnmount(invalidate);

  return {
    imageUrl,
    loading,
    errorMessage,
    errorStatus,
    loadChart,
    revokeUrl,
    invalidate
  };
};
