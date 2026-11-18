<script setup lang="ts">
// ReworkAccountOidcOptions — sign in with / link an external OpenID Connect account (slice E1; moved from
// components/account/OidcOptions.vue). The script is the original one: the provider list, the start request
// ({ purpose, redirect, locale, recover }), the outbound window.location.assign, the scope guard and the error codes
// of ?oidc_error= are unchanged; only the copy moved to rework.account.oidc.* (same texts) and the markup is new.
// purpose = "login": a secondary group under the sign-in form (heading drawn as a divider);
// purpose = "link": a sub-section of the profile page's sign-in section (h3).
import { computed, ref } from "vue";

const props = defineProps<{ purpose: "login" | "link"; redirect?: string }>();
const { t, locale } = useI18n();
const route = useRoute();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const busy = ref("");
const localError = ref(false);
const scope = useAuthFormScope(() => { busy.value = ""; localError.value = false; });
type Provider = { id: string; label: string; recoveryAvailable?: boolean; recoveryConflict?: boolean; linked?: boolean; remoteLinkEnabled?: boolean; remoteLinkStatus?: string; remoteLinkError?: string; remoteLinkUnknown?: boolean };
const key = computed(() => `oidc-options:${props.purpose}:${accountUser.value?.id || "guest"}`);
const { data } = await useAsyncData(key, () => apiFetch<{ providers: Provider[] }>(
  props.purpose === "link" ? "/api/account/oidc/bindings" : "/api/account/oidc/providers"
).catch(() => ({ providers: [] })));
const providers = computed(() => data.value?.providers || []);
const k = (name: string) => t(`rework.account.oidc.${name}`);
const copy = computed(() => (void locale.value, {
  title: props.purpose === "link" ? k("titleLink") : k("title"),
  recovery: k("recovery"), confirm: k("confirm"),
  linked: k("linked"),
  notRequested: k("notRequested"), confirmed: k("confirmed"), pending: k("pending"), unknown: k("unknown"), remoteFailed: k("remoteFailed"), retry: k("retry"),
  remoteConflict: k("remoteConflict"), reauthorize: k("reauthorize"), applicationChanged: k("applicationChanged"),
  failed: k("failed"), conflict: k("conflict"), email: k("email"), session: k("session"),
  ourtaikoEmail: k("ourtaikoEmail"), rateLimited: k("rateLimited"), identity: k("identity")
}));
const errorMessage = computed(() => {
  if (localError.value) return copy.value.failed;
  const code = route.query.oidc_error;
  if (code === "ourtaiko_email_unverified") return copy.value.ourtaikoEmail;
  if (code === "ourtaiko_rate_limited") return copy.value.rateLimited;
  if (code === "existing_viewer_required") return copy.value.recovery;
  if (code === "email_conflict") return copy.value.conflict;
  if (code === "email_required") return copy.value.email;
  if (code === "session_changed") return copy.value.session;
  if (code === "identity_conflict") return copy.value.identity;
  return code ? copy.value.failed : "";
});
// zh 「登录 X」/「关联 X」, ja 「Xでログイン」/「Xを連携」: the original word order, now inside the locale message.
const label = (provider: Provider) => t(`rework.account.oidc.${props.purpose === "link" ? "linkWith" : "loginWith"}`, { provider: provider.label });

const canRetry = (provider: Provider) => provider.linked && provider.remoteLinkEnabled && provider.remoteLinkStatus !== "linked" && provider.remoteLinkError !== "application_changed";
const remoteLabel = (provider: Provider) => {
  if (provider.remoteLinkStatus === "linked") return copy.value.confirmed;
  if (provider.remoteLinkStatus === "not_requested") return copy.value.notRequested;
  if (provider.remoteLinkError === "application_changed") return copy.value.applicationChanged;
  if (provider.remoteLinkError === "conflict") return copy.value.remoteConflict;
  if (provider.remoteLinkError === "reauthorize") return copy.value.reauthorize;
  if (provider.remoteLinkError === "rate_limited") return copy.value.rateLimited;
  if (provider.remoteLinkUnknown) return copy.value.unknown;
  return provider.remoteLinkStatus === "failed" ? copy.value.remoteFailed : copy.value.pending;
};
async function start(provider: Provider) {
  if (busy.value || (provider.linked && !canRetry(provider) && !provider.recoveryAvailable)) return;
  const ticket = scope.capture();
  busy.value = provider.id; localError.value = false;
  try {
    const result = await apiFetch<{ authorizationUrl: string }>(`/api/account/oidc/${provider.id}/start`, {
      method: "POST", body: { purpose: props.purpose, redirect: props.redirect, locale: locale.value, recover: provider.recoveryAvailable === true }
    });
    if (scope.current(ticket)) window.location.assign(result.authorizationUrl);
  } catch { if (scope.current(ticket)) localError.value = true; }
  finally { if (scope.currentView(ticket)) busy.value = ""; }
}
</script>

<template>
  <section v-if="providers.length" class="oidc-options" :class="`is-${purpose}`" :aria-label="copy.title">
    <component :is="purpose === 'link' ? 'h3' : 'h2'" class="oidc-options__title" :class="{ 'rw-or': purpose === 'login' }">{{ copy.title }}</component>
    <p v-if="errorMessage" class="rw-alert" role="alert">{{ errorMessage }}</p>
    <ul class="oidc-provider-list">
      <li v-for="provider in providers" :key="provider.id" class="oidc-provider">
        <p v-if="provider.recoveryConflict" class="rw-alert" role="alert">{{ copy.recovery }}</p>
        <div v-if="provider.linked" class="oidc-provider__state">
          <span class="oidc-linked"><ReworkIcon name="link" />{{ provider.label }} · {{ copy.linked }}</span>
          <p v-if="provider.remoteLinkEnabled || provider.remoteLinkStatus !== 'not_requested'" class="oidc-remote" :class="{ 'is-ok': provider.remoteLinkStatus === 'linked' }" role="status">{{ remoteLabel(provider) }}</p>
        </div>
        <button
          v-if="!provider.recoveryConflict && (!provider.linked || canRetry(provider) || provider.recoveryAvailable)"
          type="button"
          class="rw-btn rw-btn--block"
          :class="{ 'is-busy': busy === provider.id }"
          :disabled="Boolean(busy)"
          :aria-busy="busy === provider.id"
          @click="start(provider)"
        >{{ provider.recoveryAvailable ? copy.confirm : provider.linked ? copy.retry : label(provider) }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.oidc-options {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  font-family: var(--font-ui);
}
.oidc-options__title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
  color: var(--ink);
}
.oidc-options__title.rw-or {
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.oidc-provider-list {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.oidc-provider {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.oidc-provider .rw-btn {
  height: auto;
  padding-block: 10px;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: center;
}
.oidc-provider__state {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.oidc-linked {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.oidc-linked svg {
  width: 18px;
  height: 18px;
  color: var(--ink-2);
}
.oidc-remote {
  margin: 0;
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.oidc-remote.is-ok {
  color: var(--ink);
}
</style>
