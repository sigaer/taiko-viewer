import { ref, watch, type Ref } from "vue";

type ChartQuery = Record<string, string | number | boolean | undefined>;

// The image and its caption share the same immutable request parameters.
// A changed condition discards the old image, including an in-flight response.
export const useToolChartResult = (query: Ref<ChartQuery>) => {
  const chart = useToolChartImage();
  const resultQuery = ref<ChartQuery | null>(null);
  const changed = ref(false);
  let revision = 0;
  watch(query, () => {
    revision++;
    changed.value = changed.value || Boolean(chart.imageUrl.value || chart.loading.value || resultQuery.value);
    resultQuery.value = null;
    chart.invalidate();
  }, { flush: "sync" });
  const accountUser = useState<{ id: number } | null>("account-user", () => null);
  const bindingGeneration = useState("account-binding-generation", () => 0);
  watch(() => [accountUser.value?.id, bindingGeneration.value], () => {
    revision++; resultQuery.value = null; changed.value = false;
  }, { flush: "sync" });
  const generate = async (path: string) => {
    const request = ++revision;
    const submitted = { ...query.value };
    await chart.loadChart(path, submitted);
    if (request === revision && chart.imageUrl.value) {
      resultQuery.value = submitted;
      changed.value = false;
    }
  };
  return { ...chart, resultQuery, changed, generate };
};
