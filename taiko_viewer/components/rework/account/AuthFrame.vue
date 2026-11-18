<script setup lang="ts">
// ReworkAccountAuthFrame — the one focused column of the sign-in, registration and recovery pages (slice E1).
// The page's own <h1>, then the form and the secondary actions (default slot), then the links to the other entry
// pages (`footer` slot). The form markup stays in the page (autocomplete attributes are checked there); it uses the
// shared form pieces of assets/css/ds/rework.css.
defineProps({ title: { type: String, required: true } });
</script>

<template>
  <div class="ra-auth">
    <ReworkPageHeader :title="title" />
    <div class="ra-auth__body"><slot /></div>
    <nav v-if="$slots.footer" class="ra-auth__foot"><slot name="footer" /></nav>
  </div>
</template>

<style scoped>
.ra-auth {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: var(--sp-6) 0 var(--sp-10);
  font-family: var(--font-ui);
  color: var(--ink);
}
.ra-auth__body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  min-width: 0;
}
.ra-auth__foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-2) var(--sp-5);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.ra-auth__foot :slotted(a) {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-1);
}
@media (max-width: 767px) {
  .ra-auth {
    padding-top: var(--sp-2);
    gap: var(--sp-5);
  }
}
</style>
