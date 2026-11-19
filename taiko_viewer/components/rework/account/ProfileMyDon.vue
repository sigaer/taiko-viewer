<script setup lang="ts">
// ReworkAccountProfileMyDon — 我的小咚 on /account/profile (presentation only; slice E1): the generated image and the
// title showcase (layout, five ordered slots, save / back to default). The state order is the page's original one:
// loading → no binding → read failed → no local score data → no candidate titles → the editor. The slot options and
// their labels come from the page (optionsFor / optionLabel); saving and resetting are the page's requests.
import type { PropType } from "vue";
import type { MyDonShowcaseLayout, MyDonShowcasePayload, MyDonShowcaseTitleOption } from "~/utils/rework/account";

defineProps({
  hasBinding: { type: Boolean, default: false },
  showcase: { type: Object as PropType<MyDonShowcasePayload | null>, default: null },
  pending: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  availableCount: { type: Number, default: 0 },
  slots: { type: Array as PropType<string[]>, required: true },
  layout: { type: String as PropType<MyDonShowcaseLayout>, required: true },
  selection: { type: Array as PropType<string[]>, required: true },
  saving: { type: Boolean, default: false },
  dirty: { type: Boolean, default: false },
  canReset: { type: Boolean, default: false },
  optionsFor: { type: Function as PropType<(index: number) => MyDonShowcaseTitleOption[]>, required: true },
  optionLabel: { type: Function as PropType<(option: MyDonShowcaseTitleOption) => string>, required: true },
  imageUrl: { type: String, default: "" },
  imageFailed: { type: Boolean, default: false }
});
const emit = defineEmits<{
  "update:slot": [index: number, value: string];
  "update:layout": [value: MyDonShowcaseLayout];
  save: [];
  reset: [];
  retry: [];
  imageError: [];
}>();
const { t } = useI18n();
const p = (key: string, values?: Record<string, unknown>) => t(`rework.account.profile.${key}`, values || {});
const LAYOUTS: { value: MyDonShowcaseLayout; key: string }[] = [
  { value: "nickname", key: "showcaseLayoutNickname" },
  { value: "full", key: "showcaseLayoutFull" },
  { value: "full_gold", key: "showcaseLayoutFullGold" }
];
</script>

<template>
  <div class="ram">
    <div class="ram__image mydon-card">
      <ReworkState v-if="!hasBinding" kind="empty" compact :title="p('myDonNeedBinding')" />
      <div v-else-if="!imageFailed" class="mydon-frame">
        <img :src="imageUrl" :alt="p('myDon')" class="mydon-image" decoding="async" @error="emit('imageError')" />
      </div>
      <ReworkState v-else kind="empty" compact :title="p('myDonFailed')" />
    </div>

    <div class="ram__config mydon-config-card">
      <h3>{{ p("showcaseTitle") }}</h3>
      <ReworkState v-if="pending" kind="loading" compact :lines="5" />
      <ReworkState v-else-if="!hasBinding" kind="empty" compact :title="p('showcaseNeedBinding')" />
      <ReworkState v-else-if="failed" kind="failed" compact :title="p('showcaseLoadFailed')" @retry="emit('retry')" />
      <ReworkState v-else-if="!showcase?.hasUserdata" kind="empty" compact :title="p('showcaseNeedUserdata')" />
      <ReworkState v-else-if="!availableCount" kind="empty" compact :title="p('showcaseEmpty')" />
      <div v-else class="showcase-config">
        <dl class="showcase-status">
          <div>
            <dt>{{ p("showcaseMode") }}</dt>
            <dd>{{ showcase.isCustom ? p("showcaseModeCustom") : p("showcaseModeDefault") }}</dd>
          </div>
          <div>
            <dt>{{ p("showcaseSelection") }}</dt>
            <dd>{{ selection.length ? selection.join(" / ") : p("showcaseSelectionEmpty") }}</dd>
          </div>
        </dl>

        <div class="rw-field">
          <span id="showcase-layout-label" class="rw-field__label">{{ p("showcaseLayout") }}</span>
          <div class="rw-seg" role="group" aria-labelledby="showcase-layout-label">
            <button v-for="item in LAYOUTS" :key="item.value" type="button" :aria-pressed="layout === item.value" @click="emit('update:layout', item.value)">{{ p(item.key) }}</button>
          </div>
        </div>

        <p class="showcase-hint">{{ p("showcaseOrderHint") }}</p>
        <ol class="showcase-slot-list">
          <li v-for="slotIndex in 5" :key="slotIndex" class="showcase-slot-item">
            <label :for="`showcase-slot-${slotIndex}`" class="rw-field__label">{{ p("showcaseSlot", { index: slotIndex }) }}</label>
            <el-select
              :id="`showcase-slot-${slotIndex}`"
              :model-value="slots[slotIndex - 1]"
              filterable
              clearable
              :persistent="false"
              class="showcase-slot-item__select"
              :placeholder="p('showcasePlaceholder')"
              @update:model-value="(value: string | undefined) => emit('update:slot', slotIndex - 1, value ?? '')"
            >
              <el-option v-for="option in optionsFor(slotIndex - 1)" :key="option.titleName" :label="optionLabel(option)" :value="option.titleName" />
            </el-select>
          </li>
        </ol>
        <p class="showcase-hint">{{ p("showcaseClearHint") }}</p>

        <div class="showcase-actions">
          <button type="button" class="rw-btn rw-btn--primary" :class="{ 'is-busy': saving }" :disabled="saving || !dirty" :aria-busy="saving" @click="emit('save')">{{ p("showcaseSave") }}</button>
          <button type="button" class="rw-btn" :disabled="saving || !canReset" @click="emit('reset')">{{ p("showcaseReset") }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ram {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  min-width: 0;
}
.ram h3 {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-16);
  font-weight: 700;
}
.mydon-frame {
  display: flex;
  justify-content: center;
  padding: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.mydon-image {
  display: block;
  max-width: 100%;
  height: auto;
}
.showcase-config {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.showcase-status {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-14);
}
.showcase-status div {
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--sp-3);
  min-width: 0;
}
.showcase-status dt {
  color: var(--ink-2);
}
.showcase-status dd {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.showcase-hint {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.showcase-slot-list {
  display: grid;
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.showcase-slot-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
}
.showcase-slot-item__select {
  width: 100%;
}
.showcase-slot-item__select :deep(.el-select__wrapper) {
  min-height: var(--hit);
}
.showcase-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
@media (max-width: 767px) {
  .showcase-slot-item {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
