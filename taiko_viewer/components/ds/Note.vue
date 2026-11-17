<script setup lang="ts">
// A game note (P0-15; 04 §2.5, §3, §8; V1.2 §9.12 `.note`). Represents game data only: a fact type, a legend dot,
// a new-record dot. Colours are the domain note tokens; Ka is the blue-shifted --ka (D1).
//
// Usually it sits next to text that already says what it is, so it is hidden from assistive technology by default;
// pass `labelled` when the note stands alone and its name (ds.note.*) must be announced.
type DsNoteType = "don" | "ka" | "roll" | "ghost";
type DsNoteMarker = "fc" | "dfc";

const props = withDefaults(
  defineProps<{
    type?: DsNoteType;
    big?: boolean;
    /** fc = full-combo gold inner ring; dfc = all-perfect (don face, white ring, rainbow rim). */
    marker?: DsNoteMarker | null;
    labelled?: boolean;
  }>(),
  { type: "don", big: false, marker: null, labelled: false }
);

const { t } = useI18n();

const nameKey = computed(() => {
  if (props.marker) return `ds.note.${props.marker}`;
  if (props.type === "ghost" || !props.big) return `ds.note.${props.type}`;
  return `ds.note.big${props.type[0].toUpperCase()}${props.type.slice(1)}`;
});
</script>

<template>
  <span
    class="ds-note"
    :class="[`ds-note--${type}`, { 'ds-note--big': big, [`ds-note--${marker}`]: marker }]"
    :role="labelled ? 'img' : undefined"
    :aria-label="labelled ? t(nameKey) : undefined"
    :aria-hidden="labelled ? undefined : 'true'"
    :data-note="marker || type"
  />
</template>

<style scoped>
.ds-note {
  --n: 14px;
  --note-face: var(--don);
  display: inline-block;
  flex: none;
  inline-size: var(--n);
  block-size: var(--n);
  border-radius: var(--r-note);
  vertical-align: middle;
  background: var(--note-face);
  box-shadow:
    inset 0 0 0 calc(var(--n) * 0.14) color-mix(in srgb, var(--note-ring) 92%, transparent),
    0 0 0 1px color-mix(in srgb, var(--note-outline) 55%, transparent);
}
.ds-note--big {
  --n: 20px;
}
.ds-note--ka {
  --note-face: var(--ka);
}
.ds-note--roll {
  --note-face: var(--roll);
}
.ds-note--ghost {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ink-3);
}
/* New full combo: gold inner ring (same as the lane's full-combo note) */
.ds-note--fc {
  box-shadow:
    inset 0 0 0 calc(var(--n) * 0.16) var(--note-fc),
    0 0 0 1px color-mix(in srgb, var(--note-outline) 55%, transparent);
}
/* New all-perfect: don face, white ring, rainbow rim */
.ds-note--dfc {
  background:
    radial-gradient(circle closest-side, var(--don) 0 50%, var(--note-ring) 52% 72%, transparent 74%),
    var(--crown-dfc);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--note-outline) 55%, transparent);
}
</style>
