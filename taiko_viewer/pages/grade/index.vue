<script setup lang="ts">
const localePath = useLocalePath();
await navigateTo(localePath("/grade/2026"), {
  redirectCode: 302
});
</script>

<template>
  <div></div>
</template>
