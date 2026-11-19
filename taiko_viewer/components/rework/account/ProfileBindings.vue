<script setup lang="ts">
// ReworkAccountProfileBindings — the 游戏账号 section of /account/profile (presentation only; slice E1).
// Every request, confirmation and guard stays in the page: this component shows the state it is given and emits the
// user's intent. The page's scroll / focus targets are handed back through the set* function refs:
//   setCard      the binding form (the onboarding button reveals it and focuses its input)
//   setInput     the Donder Hiroba ID input
//   setPendingBox the pending challenge (revealed when a challenge starts; its first button is the confirmation)
// Order: onboarding (unbound), re-verification notice, the bindings (source stamp CN / JP / 手动, current marker and
// the same actions as before), the binding form with the pending challenge, the manual score account panel.
import type { PropType } from "vue";
import type { ProfileBinding, ProfilePayload } from "~/utils/rework/account";
import { bindingStampKey } from "~/utils/rework/account";

type ElementRef = (el: Element | null) => void;
defineProps({
  profile: { type: Object as PropType<ProfilePayload>, required: true },
  needsOnboarding: { type: Boolean, default: false },
  bindingInput: { type: String, default: "" },
  manualNickname: { type: String, default: "" },
  manualClaimCode: { type: String, default: "" },
  preparing: { type: Boolean, default: false },
  confirming: { type: Boolean, default: false },
  switchingId: { type: Number as PropType<number | null>, default: null },
  deletingId: { type: Number as PropType<number | null>, default: null },
  manualLoading: { type: Boolean, default: false },
  setCard: { type: Function as PropType<ElementRef>, required: true },
  setInput: { type: Function as PropType<ElementRef>, required: true },
  setPendingBox: { type: Function as PropType<ElementRef>, required: true }
});
const emit = defineEmits<{
  "update:bindingInput": [value: string];
  "update:manualNickname": [value: string];
  "update:manualClaimCode": [value: string];
  onboard: [];
  inputFocus: [];
  prepare: [];
  confirm: [];
  switch: [id: number];
  remove: [binding: ProfileBinding];
  rename: [binding: ProfileBinding];
  claimCode: [binding: ProfileBinding];
  detach: [binding: ProfileBinding];
  deleteManual: [binding: ProfileBinding];
  createManual: [];
  claimManual: [];
}>();
const { t } = useI18n();
const { formatDateTime } = useViewerDateTime();
const p = (key: string) => t(`rework.account.profile.${key}`);
const value = (event: Event) => (event.target as HTMLInputElement).value;
</script>

<template>
  <div class="rab">
    <div v-if="needsOnboarding" class="onboarding-card" role="region" :aria-label="p('onboardTitle')">
      <div class="onboarding-copy">
        <h3>{{ p("onboardTitle") }}</h3>
        <p>{{ p("onboardDesc") }}</p>
      </div>
      <button type="button" class="rw-btn rw-btn--primary" @click="emit('onboard')">{{ p("onboardCta") }}</button>
    </div>

    <p v-if="profile.currentBinding?.requiresReverification" class="rw-note rab__notice" role="status">
      <ReworkIcon name="warn" /><span>{{ p("legacyBindingNotice") }}</span>
    </p>

    <ul v-if="profile.bindings.length" class="binding-list">
      <li v-for="binding in profile.bindings" :key="binding.id" class="binding-item" :class="{ 'binding-item--manual': binding.isManual, 'is-current': binding.isCurrent }">
        <div class="binding-item__main">
          <p class="binding-heading">
            <strong>{{ binding.displayName || binding.taikoId }}</strong>
            <span class="rw-tag source-stamp" :class="`source-stamp--${binding.source}`">{{ p(bindingStampKey(binding.source)) }}</span>
            <span v-if="binding.requiresReverification" class="rw-tag rw-tag--warn">{{ p("reverify") }}</span>
          </p>
          <p class="binding-item__sub">
            <span v-if="binding.displayName && binding.displayName !== binding.taikoId" class="num">{{ binding.taikoId }}</span>
            <DsTitlePlate v-if="binding.verifiedTitle" :name="binding.verifiedTitle" :plate="binding.verifiedTitleplateId" form="text" />
            <span v-else>—</span>
          </p>
        </div>
        <div class="binding-actions">
          <span v-if="binding.isCurrent" class="rw-tag rw-tag--info binding-current" role="status"><ReworkIcon name="check" />{{ p("currentUsing") }}</span>
          <button
            v-else
            type="button"
            class="rw-btn rw-btn--sm"
            :class="{ 'is-busy': switchingId === binding.id }"
            :disabled="switchingId === binding.id"
            :aria-busy="switchingId === binding.id"
            @click="emit('switch', binding.id)"
          >{{ p("switchCurrent") }}</button>
          <template v-if="binding.isManual">
            <button type="button" class="rw-btn rw-btn--sm" @click="emit('rename', binding)">{{ p("manualRename") }}</button>
            <button type="button" class="rw-btn rw-btn--sm" @click="emit('claimCode', binding)">{{ p("manualClaimCode") }}</button>
            <button type="button" class="rw-btn rw-btn--sm rw-btn--danger" @click="emit('detach', binding)">{{ p("manualDetach") }}</button>
            <button type="button" class="rw-btn rw-btn--sm rw-btn--danger" @click="emit('deleteManual', binding)">{{ p("manualDelete") }}</button>
          </template>
          <button
            v-else
            type="button"
            class="rw-btn rw-btn--sm rw-btn--danger"
            :class="{ 'is-busy': deletingId === binding.id }"
            :disabled="deletingId === binding.id"
            :aria-busy="deletingId === binding.id"
            @click="emit('remove', binding)"
          >{{ p("deleteBinding") }}</button>
        </div>
      </li>
    </ul>
    <ReworkState v-else-if="!needsOnboarding" kind="empty" compact :title="p('noBindings')" />

    <div :ref="setCard" class="binding-card">
      <h3>{{ p("bindTitle") }}</h3>
      <p class="binding-card__desc">{{ p("bindDesc") }}</p>
      <label class="rw-field__label binding-field-label" for="binding-taiko-id">{{ p("bindInputLabel") }}</label>
      <div class="bind-input-row">
        <input
          id="binding-taiko-id"
          :ref="setInput"
          class="rw-input"
          :value="bindingInput"
          autocomplete="off"
          :placeholder="p('bindPlaceholder')"
          @input="emit('update:bindingInput', value($event))"
          @focus="emit('inputFocus')"
        />
        <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': preparing }" :disabled="preparing" :aria-busy="preparing" @click="emit('prepare')">{{ p("startVerify") }}</button>
      </div>
      <div v-if="profile.pendingBinding" :ref="setPendingBox" class="pending-box" tabindex="-1">
        <dl>
          <div><dt>{{ p("pendingId") }}</dt><dd class="num">{{ profile.pendingBinding.taikoId }}</dd></div>
          <div><dt>{{ p("pendingTitle") }}</dt><dd>{{ profile.pendingBinding.originalTitle || p("emptyTitle") }}</dd></div>
          <div><dt>{{ p("expiresAt") }}</dt><dd>{{ formatDateTime(profile.pendingBinding.expiresAt) }}</dd></div>
        </dl>
        <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': confirming }" :disabled="confirming" :aria-busy="confirming" @click="emit('confirm')">{{ p("confirmBinding") }}</button>
      </div>
    </div>

    <details class="manual-account-panel">
      <summary>{{ p("manualTitle") }}</summary>
      <p class="manual-account-copy">{{ p("manualDesc") }}</p>
      <div class="manual-account-controls">
        <label class="rw-vh" for="manual-nickname">{{ p("manualNickname") }}</label>
        <input id="manual-nickname" class="rw-input" :value="manualNickname" maxlength="24" autocomplete="off" :placeholder="p('manualNickname')" @input="emit('update:manualNickname', value($event))" @keyup.enter="emit('createManual')" />
        <button type="button" class="rw-btn" :class="{ 'is-busy': manualLoading }" :disabled="manualLoading || !manualNickname.trim()" @click="emit('createManual')">{{ p("manualCreate") }}</button>
        <label class="rw-vh" for="manual-claim">{{ p("manualClaimPlaceholder") }}</label>
        <input id="manual-claim" class="rw-input" :value="manualClaimCode" maxlength="12" autocomplete="off" :placeholder="p('manualClaimPlaceholder')" @input="emit('update:manualClaimCode', value($event))" @keyup.enter="emit('claimManual')" />
        <button type="button" class="rw-btn" :class="{ 'is-busy': manualLoading }" :disabled="manualLoading || !manualClaimCode.trim()" @click="emit('claimManual')">{{ p("manualClaim") }}</button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.rab {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  min-width: 0;
}
.onboarding-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-left: 3px solid var(--action-bg);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.onboarding-copy {
  min-width: 0;
}
.onboarding-copy h3 {
  margin: 0 0 4px;
  font-size: var(--fs-16);
  font-weight: 700;
}
.onboarding-copy p {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.rab__notice {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
}
.rab__notice svg {
  width: 18px;
  height: 18px;
  margin-top: 2px;
}
.binding-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.binding-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.binding-item:last-child {
  border-bottom: 0;
}
.binding-item.is-current {
  box-shadow: inset 3px 0 0 var(--selected-line);
}
.binding-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 220px;
  min-width: 0;
}
.binding-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--sp-2);
  margin: 0;
}
.binding-heading strong {
  font-size: var(--fs-16);
  overflow-wrap: anywhere;
}
.binding-item__sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--sp-3);
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
  min-width: 0;
}
.binding-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-2);
}
.binding-current {
  height: auto;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
}
.binding-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.binding-card:focus {
  outline: none;
}
.binding-card h3 {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.binding-card__desc {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.bind-input-row {
  display: flex;
  gap: var(--sp-2);
}
.bind-input-row .rw-input {
  flex: 1;
  min-width: 0;
}
.pending-box {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
  padding: var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--info-wash);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.pending-box:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.pending-box dl {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
  font-size: var(--fs-14);
}
.pending-box dl div {
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--sp-2);
}
.pending-box dt {
  color: var(--ink-2);
}
.pending-box dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.pending-box .rw-btn {
  align-self: flex-start;
  white-space: normal;
}
.manual-account-panel {
  border-top: 1px solid var(--line);
  padding-top: var(--sp-2);
}
.manual-account-panel summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  color: var(--link);
  font-size: var(--fs-14);
  cursor: pointer;
}
.manual-account-panel summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.manual-account-copy {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.manual-account-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--sp-2) var(--sp-2);
}
@media (max-width: 767px) {
  .binding-item {
    padding: var(--sp-3) var(--sp-4);
  }
  .binding-actions {
    justify-content: flex-start;
  }
  .bind-input-row {
    flex-wrap: wrap;
  }
  .bind-input-row .rw-btn {
    flex: 1 1 100%;
  }
  .manual-account-controls {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
