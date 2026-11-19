<script setup lang="ts">
const localePath = useLocalePath();
await navigateTo(localePath("/songs/available"), {
  redirectCode: 302
});
</script>
