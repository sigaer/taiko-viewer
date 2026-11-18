<template>
  <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="var(--brand-mark)" />
    <circle
      v-for="i in 12"
      :key="i"
      :cx="20 + Math.cos((i * Math.PI) / 6) * 16.2"
      :cy="20 + Math.sin((i * Math.PI) / 6) * 16.2"
      r="1.15"
      fill="var(--note-outline)"
      opacity=".7"
    />
    <circle
      cx="20"
      cy="20"
      r="13"
      fill="var(--don)"
      stroke="var(--note-ring)"
      stroke-width="2"
    />
    <path
      d="M14.5 15.5h11M20 15.5V26"
      stroke="var(--note-ring)"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>
