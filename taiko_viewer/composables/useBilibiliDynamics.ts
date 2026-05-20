import type { BilibiliDynamicItem, BilibiliDynamicResponse } from "~/types/bilibili";
import { BILIBILI_DYNAMIC_LIMIT, BILIBILI_DYNAMIC_UID } from "~/utils/bilibili";

const CACHE_DURATION_MS = 5 * 60 * 1000;

type FeedCacheEntry = {
  items: BilibiliDynamicItem[];
  timestamp: number;
};

const feedCache: Record<string, FeedCacheEntry> = {};

const filterDynamics = (items: BilibiliDynamicItem[]) =>
  items
    .filter((item) => item.modules.module_tag?.text !== "置顶")
    .slice(0, BILIBILI_DYNAMIC_LIMIT);

export const useBilibiliDynamics = (uid: string = BILIBILI_DYNAMIC_UID) => {
  const items = ref<BilibiliDynamicItem[]>([]);
  const pending = ref(true);
  const error = ref<string | null>(null);

  const load = async () => {
    const cached = feedCache[uid];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      items.value = cached.items;
      pending.value = false;
      error.value = null;
      return;
    }

    pending.value = true;
    error.value = null;

    try {
      const response = await $fetch<BilibiliDynamicResponse>(`/api/bilibili/dynamic/${uid}`);
      if (response.code !== 0) {
        throw new Error(response.message || "加载失败");
      }

      const nextItems = filterDynamics(response.data?.items || []);
      items.value = nextItems;
      feedCache[uid] = {
        items: nextItems,
        timestamp: Date.now()
      };
    } catch (value) {
      items.value = [];
      error.value = value instanceof Error ? value.message : "加载失败";
    } finally {
      pending.value = false;
    }
  };

  onMounted(() => {
    void load();
  });

  return {
    items,
    pending,
    error,
    reload: load
  };
};
