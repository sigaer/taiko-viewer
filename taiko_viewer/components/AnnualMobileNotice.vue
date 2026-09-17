<script setup lang="ts">
import { isAnnualMobileBrowser } from "~/utils/annualDevice";
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();
const visible = ref(false);
let stop: (() => void) | undefined;

onMounted(() => {
  stop = watch(() => route.query.annualMobileOnly, async (target) => {
    if (target !== "entry" && target !== "report") return;
    if (isAnnualMobileBrowser(navigator.userAgent, navigator.maxTouchPoints)) {
      await navigateTo(localePath(target === "report" ? "/account/version-summary" : "/annual"), { replace: true });
      return;
    }
    visible.value = true;
    const { annualMobileOnly, ...query } = route.query;
    await router.replace({ path: route.path, query, hash: route.hash });
  }, { immediate: true });
});
onBeforeUnmount(() => stop?.());
</script>

<template>
  <ClientOnly>
    <el-dialog v-model="visible" :title="t('account.versionSummary')" width="min(420px, calc(100vw - 32px))" align-center>
      <p>{{ t('annualSummary.state.mobileOnly') }}</p>
      <template #footer><el-button type="primary" @click="visible = false">{{ t('common.confirm') }}</el-button></template>
    </el-dialog>
  </ClientOnly>
</template>
