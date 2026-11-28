<script setup lang="ts">
// ReworkCommunitySearch — the thread search field (threads.get `keyword`, a title search, at most 80 characters).
// Emits the trimmed keyword on submit ("" clears it); the page decides where it goes.
const props = defineProps({
  modelValue: { type: String, default: "" }
});
const emit = defineEmits<{ "update:modelValue": [value: string]; search: [keyword: string] }>();
const { t } = useI18n();
const id = useId();
const value = ref(props.modelValue);
watch(() => props.modelValue, (next) => { value.value = next; });
const submit = () => emit("search", value.value.trim().slice(0, 80));
</script>

<template>
  <form class="csr" role="search" @submit.prevent="submit">
    <label :for="id" class="rw-vh">{{ t("rework.forum.search.label") }}</label>
    <span class="csr__field">
      <ReworkIcon name="search" />
      <input
        :id="id"
        v-model="value"
        class="csr__input"
        type="search"
        enterkeyhint="search"
        maxlength="80"
        autocomplete="off"
        :placeholder="t('rework.forum.search.placeholder')"
        @input="emit('update:modelValue', value)"
      />
    </span>
    <button type="submit" class="rw-btn csr__go">{{ t("rework.forum.search.submit") }}</button>
  </form>
</template>

<style scoped>
.csr {
  display: flex;
  gap: var(--sp-2);
  min-width: 0;
  font-family: var(--font-ui);
}
.csr__field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink-3);
}
.csr__field:focus-within {
  border-color: var(--input-focus-line);
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.csr__field :deep(svg) {
  flex: none;
  width: 18px;
  height: 18px;
}
.csr__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
}
.csr__input:focus {
  outline: none;
}
.csr__go {
  flex: none;
}
</style>
