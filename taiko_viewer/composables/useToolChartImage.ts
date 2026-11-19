import { onBeforeUnmount, ref, watch } from "vue";
import { resolveViewerError } from "~/utils/viewerError";

export const useToolChartImage = () => {
  const { t, locale } = useI18n();
  const imageUrl = ref("");
  const loading = ref(false);
  const errorMessage = ref("");
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
      const message = await resolveViewerError(error, locale.value === "ja" ? "画像を生成できませんでした。再試行してください" : "图表生成失败，请重试", t);
      if (request === generation) errorMessage.value = message;
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
    revokeUrl();
  };
  watch(() => [accountUser.value?.id, bindingGeneration.value], invalidate, { flush: "sync" });
  onBeforeUnmount(invalidate);

  return {
    imageUrl,
    loading,
    errorMessage,
    loadChart,
    revokeUrl,
    invalidate
  };
};
