import { onMounted, ref } from "vue";

type ClientContentState<T> = {
  data: Ref<T>;
  pending: Ref<boolean>;
  error: Ref<Error | null>;
  reload: () => Promise<void>;
};

export const useClientContentState = <T>(
  loader: () => Promise<T>,
  createDefault: () => T
): ClientContentState<T> => {
  const data = ref(createDefault()) as Ref<T>;
  const pending = ref(true);
  const error = ref<Error | null>(null);

  const reload = async () => {
    pending.value = true;
    try {
      data.value = await loader();
      error.value = null;
    } catch (value) {
      error.value = value instanceof Error ? value : new Error("内容加载失败");
    } finally {
      pending.value = false;
    }
  };

  onMounted(() => {
    void reload();
  });

  return {
    data,
    pending,
    error,
    reload
  };
};
