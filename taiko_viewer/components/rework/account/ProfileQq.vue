<script setup lang="ts">
// ReworkAccountProfileQq — the QQ binding of /account/profile (presentation only; slice E1). Three states as the
// API returns them: active (number, bound time, unbind), pending (number, code input, confirm, unbind), none (number
// input → the code that was sent → code input and confirm). Requests, the unbind confirmation and the guards stay in
// the page; `setVerifyBox` hands the code box back to the page (revealed and its input focused after the code is sent).
import type { PropType } from "vue";
import type { QqBindingPayload } from "~/utils/rework/account";

type ElementRef = (el: Element | null) => void;
defineProps({
  binding: { type: Object as PropType<QqBindingPayload>, default: null },
  codeResult: { type: Object as PropType<{ expiresAt: string } | null>, default: null },
  qqInput: { type: String, default: "" },
  verifyCode: { type: String, default: "" },
  preparing: { type: Boolean, default: false },
  confirming: { type: Boolean, default: false },
  removing: { type: Boolean, default: false },
  setVerifyBox: { type: Function as PropType<ElementRef>, required: true }
});
const emit = defineEmits<{
  "update:qqInput": [value: string];
  "update:verifyCode": [value: string];
  prepare: [];
  confirm: [];
  remove: [];
}>();
const { t } = useI18n();
const { formatDateTime } = useViewerDateTime();
const p = (key: string) => t(`rework.account.profile.${key}`);
const value = (event: Event) => (event.target as HTMLInputElement).value;
</script>

<template>
  <div class="qq-card" role="group" :aria-labelledby="'qq-title'">
    <div class="qq-card__head">
      <h3 id="qq-title">{{ p("qqTitle") }}</h3>
      <span v-if="binding?.status === 'active'" class="rw-tag rw-tag--ok"><ReworkIcon name="check" />{{ p("qqBound") }}</span>
      <span v-else-if="binding?.status === 'pending'" class="rw-tag rw-tag--warn">{{ p("qqPending") }}</span>
      <span v-else class="rw-tag">{{ p("qqUnbound") }}</span>
    </div>
    <p class="qq-card__desc">{{ p("qqDesc") }}</p>

    <div v-if="binding && binding.status === 'active'" class="qq-bound-row">
      <div>
        <strong>{{ p("qqNumberLabel") }}<span class="num">{{ binding.qqNumber }}</span></strong>
        <p>{{ p("qqBound") }} · {{ formatDateTime(binding.verifiedAt || binding.createdAt) }}</p>
      </div>
      <button type="button" class="rw-btn rw-btn--sm rw-btn--danger" :class="{ 'is-busy': removing }" :disabled="removing" :aria-busy="removing" @click="emit('remove')">{{ p("qqUnbind") }}</button>
    </div>

    <div v-else-if="binding && binding.status === 'pending'" class="qq-pending-row">
      <strong>{{ p("qqNumberLabel") }}<span class="num">{{ binding.qqNumber }}</span></strong>
      <p id="qq-pending-hint" class="qq-pending-hint">{{ p("qqCodeHint") }}</p>
      <div class="qq-verify-row">
        <label class="rw-vh" for="qq-code-pending">{{ p("qqConfirmPlaceholder") }}</label>
        <input id="qq-code-pending" class="rw-input num" :value="verifyCode" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-describedby="qq-pending-hint" :placeholder="p('qqConfirmPlaceholder')" @input="emit('update:verifyCode', value($event))" @keyup.enter="emit('confirm')" />
        <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': confirming }" :disabled="confirming || !verifyCode.trim()" :aria-busy="confirming" @click="emit('confirm')">{{ p("qqConfirmButton") }}</button>
      </div>
      <button type="button" class="rw-btn rw-btn--sm rw-btn--danger qq-unbind" :class="{ 'is-busy': removing }" :disabled="removing" :aria-busy="removing" @click="emit('remove')">{{ p("qqUnbind") }}</button>
    </div>

    <template v-else>
      <div v-if="codeResult" :ref="setVerifyBox" class="qq-code-result" tabindex="-1">
        <p role="status">{{ p("qqCodeReady") }}</p>
        <p id="qq-code-hint" class="qq-code-hint">{{ p("qqCodeHint") }}</p>
        <div class="qq-verify-row">
          <label class="rw-vh" for="qq-code">{{ p("qqConfirmPlaceholder") }}</label>
          <input id="qq-code" class="rw-input num" :value="verifyCode" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-describedby="qq-code-hint" :placeholder="p('qqConfirmPlaceholder')" @input="emit('update:verifyCode', value($event))" @keyup.enter="emit('confirm')" />
          <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': confirming }" :disabled="confirming || !verifyCode.trim()" :aria-busy="confirming" @click="emit('confirm')">{{ p("qqConfirmButton") }}</button>
        </div>
      </div>
      <div v-else class="qq-verify-row">
        <label class="rw-vh" for="qq-number">{{ p("qqPlaceholder") }}</label>
        <input id="qq-number" class="rw-input num" :value="qqInput" inputmode="numeric" autocomplete="off" :placeholder="p('qqPlaceholder')" @input="emit('update:qqInput', value($event))" @keyup.enter="emit('prepare')" />
        <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': preparing }" :disabled="preparing || !qqInput.trim()" :aria-busy="preparing" @click="emit('prepare')">{{ p("qqStartVerify") }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.qq-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.qq-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}
.qq-card__head h3 {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.qq-card__desc,
.qq-pending-hint,
.qq-code-hint {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.qq-bound-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.qq-bound-row p {
  margin: 2px 0 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.qq-pending-row,
.qq-code-result {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.qq-code-result {
  padding: var(--sp-4);
  border-radius: var(--r-ctl);
  background: var(--info-wash);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.qq-code-result:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.qq-code-result p {
  margin: 0;
  font-size: var(--fs-14);
}
.qq-verify-row {
  display: flex;
  gap: var(--sp-2);
}
.qq-verify-row .rw-input {
  flex: 1;
  min-width: 0;
}
.qq-unbind {
  align-self: flex-start;
}
@media (max-width: 767px) {
  .qq-verify-row {
    flex-wrap: wrap;
  }
  .qq-verify-row .rw-btn {
    flex: 1 1 100%;
  }
}
</style>
