import { onBeforeUnmount, watch } from "vue";

// Ignore completion callbacks belonging to another account/binding or closed view.
// This does not change server authorization or claim to undo an accepted write.
export const useAccountRequestGuard = (includeBinding = true) => {
  const user = useState<{ id: number } | null>("account-user", () => null);
  const binding = useState("account-binding-generation", () => 0);
  let generation = 0;
  const invalidate = () => { generation++; };
  watch(() => [user.value?.id, includeBinding ? binding.value : null], invalidate, { flush: "sync" });
  onBeforeUnmount(invalidate);
  return { capture: () => generation, current: (request: number) => request === generation, invalidate };
};
