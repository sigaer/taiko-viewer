<script setup lang="ts">
// ReworkAccountProfileSignIn — 登录与关联 on /account/profile (slice E1): the e-mail sign-in with its verification
// state, the linked accounts (default slot: external OIDC accounts and QQ, in the page) and signing out.
defineProps({
  email: { type: String, default: "" },
  emailVerified: { type: Boolean, default: false },
  signingOut: { type: Boolean, default: false }
});
const emit = defineEmits<{ signOut: [] }>();
const { t } = useI18n();
const p = (key: string) => t(`rework.account.profile.${key}`);
</script>

<template>
  <div class="ras">
    <div class="ras__row">
      <ReworkIcon name="mail" />
      <div class="ras__main">
        <strong>{{ p("email") }}</strong>
        <span class="ras__sub">{{ email || "—" }}</span>
      </div>
      <span class="rw-tag" :class="emailVerified ? 'rw-tag--ok' : 'rw-tag--warn'">
        <ReworkIcon v-if="emailVerified" name="check" />{{ p("emailVerified") }} · {{ emailVerified ? p("verified") : p("unverified") }}
      </span>
    </div>
    <div class="ras__links"><slot /></div>
    <div class="ras__out">
      <button type="button" class="rw-btn rw-btn--sm" :class="{ 'is-busy': signingOut }" :disabled="signingOut" :aria-busy="signingOut" @click="emit('signOut')">
        <ReworkIcon name="logout" />{{ p("signOut") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ras {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  min-width: 0;
}
.ras > * {
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.ras > :last-child {
  border-bottom: 0;
}
.ras__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}
.ras__row > svg {
  width: 20px;
  height: 20px;
  color: var(--ink-2);
}
.ras__main {
  display: flex;
  flex-direction: column;
  flex: 1 1 200px;
  min-width: 0;
}
.ras__main strong {
  font-size: var(--fs-14);
}
.ras__sub {
  font-size: var(--fs-14);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.ras__links {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}
.ras__links:empty {
  display: none;
}
.ras__out .rw-btn svg {
  width: 18px;
  height: 18px;
}
@media (max-width: 767px) {
  .ras > * {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>
