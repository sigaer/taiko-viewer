<script setup lang="ts">
const localePath = useLocalePath();
await navigateTo(localePath("/grade/2025"), {
  redirectCode: 302
});
</script>

<template>
  <div></div>
</template>
