// Establishes the design-system scope for a sample page (D0-2 / D0-3 = A, constraint 1).
//
// `ds-preview` on <html> is the only switch that turns the V1.3 tokens, the Element Plus mapping and the shared
// ds styles on. It goes through useHead so that:
//   - SSR renders <html class="ds-preview"> (no flash of unscoped styles on first paint);
//   - leaving the page removes it (entry disposed on unmount);
//   - with <NuxtPage keepalive>, @unhead/vue empties the entry on deactivate and restores it on activate
//     (node_modules/@unhead/vue clientUseHead: onDeactivated / onActivated), so a cached sample page does not
//     leave the class behind on the next page.
// Teleported Element Plus popups mount under <body>, inside <html>, so they follow the same switch.
// The browser self-check in scripts/ds/browser-check.mjs verifies enter / leave / keepalive round trips.
import { useHead } from "#imports";

export const DS_PREVIEW_CLASS = "ds-preview";

export function useDsPreviewScope() {
  useHead({
    htmlAttrs: { class: DS_PREVIEW_CLASS },
    meta: [{ key: "robots", name: "robots", content: "noindex,nofollow" }]
  });
}
