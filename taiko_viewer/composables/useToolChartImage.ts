import { onBeforeUnmount, ref } from "vue";

export const useToolChartImage = () => {
  const imageUrl = ref("");
  const loading = ref(false);
  const errorMessage = ref("");

  const revokeUrl = () => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = "";
    }
  };

  const loadChart = async (path: string, query?: Record<string, string | number | boolean | undefined>) => {
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
        credentials: "include"
      });
      imageUrl.value = URL.createObjectURL(blob);
    } catch (error: unknown) {
      const err = error as { data?: { statusMessage?: string }; statusMessage?: string; message?: string };
      errorMessage.value =
        err?.data?.statusMessage || err?.statusMessage || err?.message || "生成失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  };

  onBeforeUnmount(revokeUrl);

  return {
    imageUrl,
    loading,
    errorMessage,
    loadChart,
    revokeUrl
  };
};
