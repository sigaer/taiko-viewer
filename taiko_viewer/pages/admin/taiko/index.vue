<script setup lang="ts">
defineI18nRoute(false);

definePageMeta({
  middleware: "admin-auth"
});

await navigateTo("/admin/taiko/dashboard", { replace: true });
</script>

<template>
  <div></div>
</template>
