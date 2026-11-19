import type { Ref } from "vue";

// Presentation of a forum read (useForumResource) during hydration. When the server render failed (no session,
// database down), the payload carries the failure but no data, so the client starts the same read again before it
// hydrates: its first render would say "loading" where the server said "failed" (a hydration mismatch). Until the
// page has mounted this keeps the server's presentation (the failure captured at setup); afterwards it is the live
// read state. The read itself, its retry and its error text are untouched.
export const useForumHydratedState = (pending: Ref<boolean>, error: Ref<string>) => {
  const nuxtApp = useNuxtApp();
  const hydrated = ref(!(import.meta.client && nuxtApp.isHydrating));
  const serverError = hydrated.value ? "" : error.value;
  onMounted(() => {
    hydrated.value = true;
  });
  return {
    pending: computed(() => (hydrated.value || !serverError ? pending.value : false)),
    error: computed(() => (hydrated.value || !serverError ? error.value : serverError))
  };
};
