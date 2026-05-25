<script setup lang="ts">
const localePath = useLocalePath();
await navigateTo(localePath("/account/profile"), {
  redirectCode: 302
});
</script>

<template>
  <div></div>
</template>
