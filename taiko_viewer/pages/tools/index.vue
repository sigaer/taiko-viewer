<script setup lang="ts">
const localePath = useLocalePath();
await navigateTo(localePath("/more"), { redirectCode: 302 });
</script>
