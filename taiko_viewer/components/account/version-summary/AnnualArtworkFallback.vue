<script setup lang="ts">
withDefaults(defineProps<{
  kind?: "don" | "cover" | "qr";
  label?: string;
  mark?: string;
}>(), {
  kind: "cover",
  label: "",
  mark: "2026"
});
</script>

<template>
  <div class="annual-artwork-fallback" :class="`annual-artwork-fallback--${kind}`" role="img" :aria-label="label">
    <div v-if="kind === 'don'" class="annual-artwork-fallback__don" aria-hidden="true">
      <i></i><i></i><b></b><span>{{ mark }}</span>
    </div>
    <div v-else-if="kind === 'qr'" class="annual-artwork-fallback__qr" aria-hidden="true">
      <i></i><b>LINK</b>
    </div>
    <div v-else class="annual-artwork-fallback__cover" aria-hidden="true">
      <i></i><i></i><b>{{ mark }}</b>
    </div>
  </div>
</template>

<style scoped>
.annual-artwork-fallback{width:100%;height:100%;min-height:100%;display:grid;place-items:center;overflow:hidden;color:#17365d;background:radial-gradient(circle at 38% 28%,#fff 0 16%,#f7fbff 17% 48%,#e5f1ff 49% 100%)}
.annual-artwork-fallback__don{position:relative;width:72%;aspect-ratio:1;border-radius:50%;background:#f7fbff;border:clamp(5px,1.2vw,12px) solid #3978c8;box-shadow:0 0 0 clamp(3px,.7vw,7px) rgba(247,251,255,.9),0 12px 28px rgba(23,54,93,.14)}
.annual-artwork-fallback__don i{position:absolute;top:34%;width:10%;aspect-ratio:.72;border-radius:50%;background:#17365d}.annual-artwork-fallback__don i:first-child{left:31%}.annual-artwork-fallback__don i:nth-child(2){right:31%}.annual-artwork-fallback__don b{position:absolute;left:50%;top:54%;width:28%;height:9%;transform:translateX(-50%);border-bottom:3px solid #17365d;border-radius:0 0 50% 50%}.annual-artwork-fallback__don::before,.annual-artwork-fallback__don::after{content:"";position:absolute;top:49%;width:15%;aspect-ratio:1;border-radius:50%;background:#ee7062;opacity:.9}.annual-artwork-fallback__don::before{left:12%}.annual-artwork-fallback__don::after{right:12%}.annual-artwork-fallback__don span{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);color:#3978c8;font:700 clamp(9px,1.3vw,13px)/1 var(--viewer-font-family);letter-spacing:.08em}
.annual-artwork-fallback__cover{position:relative;width:100%;height:100%;min-height:72px;background:linear-gradient(145deg,#f7fbff,#e5f1ff)}.annual-artwork-fallback__cover::before,.annual-artwork-fallback__cover::after{content:"";position:absolute;border-radius:50%;border:2px solid rgba(57,120,200,.2)}.annual-artwork-fallback__cover::before{width:68%;aspect-ratio:1;left:-22%;bottom:-30%;box-shadow:inset 0 0 0 9px rgba(57,120,200,.06)}.annual-artwork-fallback__cover::after{width:48%;aspect-ratio:1;right:-12%;top:-18%}.annual-artwork-fallback__cover i{position:absolute;width:10%;aspect-ratio:1;border-radius:50%;background:#3978c8}.annual-artwork-fallback__cover i:first-child{left:34%;top:36%}.annual-artwork-fallback__cover i:nth-child(2){left:48%;top:46%;background:#ee7062}.annual-artwork-fallback__cover b{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);color:#3978c8;font:700 clamp(12px,2.5vw,22px)/1 var(--viewer-display-font);letter-spacing:.12em}
.annual-artwork-fallback__qr{width:100%;height:100%;display:grid;place-items:center;align-content:center;gap:5%;background:#fff}.annual-artwork-fallback__qr i{width:38%;aspect-ratio:1;border:3px solid #17365d;box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 7px #3978c8}.annual-artwork-fallback__qr b{color:#3978c8;font:700 clamp(8px,1.4vw,12px)/1 var(--viewer-font-family);letter-spacing:.08em}
</style>
