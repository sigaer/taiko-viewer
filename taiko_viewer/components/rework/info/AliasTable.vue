<script setup lang="ts">
// ReworkInfoAliasTable — one page (20 rows) of /alias-log (slice F). Same columns as before: time, song (title + ID,
// links to song detail), alias, operator, source (group or private chat), view. Below 768 px each row is a block.
import type { PropType } from "vue";

type Row = { time: string; song_id: string; song_title: string; alias: string; user_id: string; group_id?: number };
defineProps({
  rows: { type: Array as PropType<Row[]>, required: true },
  copy: { type: Object as PropType<Record<string, string>>, required: true },
  formatTime: { type: Function as PropType<(time: string) => string>, required: true },
  userOf: { type: Function as PropType<(row: never) => string>, required: true },
  groupOf: { type: Function as PropType<(row: never) => string>, required: true }
});
const localePath = useLocalePath();
</script>

<template>
  <div class="at">
    <table class="at-table">
      <thead>
        <tr>
          <th scope="col">{{ copy.time }}</th>
          <th scope="col">{{ copy.song }}</th>
          <th scope="col">{{ copy.alias }}</th>
          <th scope="col">{{ copy.user }}</th>
          <th scope="col">{{ copy.source }}</th>
          <th scope="col"><span class="rw-vh">{{ copy.action }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.time}-${row.song_id}-${row.alias}`">
          <td class="at-time num">{{ formatTime(row.time) }}</td>
          <td class="at-song">
            <NuxtLink class="at-song__link" :to="localePath(`/songs/${row.song_id}`)">
              <span class="at-song__title">{{ row.song_title }}</span>
              <span class="at-song__id num">ID: {{ row.song_id }}</span>
            </NuxtLink>
          </td>
          <td><span class="at-alias">{{ row.alias }}</span></td>
          <td class="at-user" :data-label="copy.user">{{ userOf(row as never) }}</td>
          <td class="at-group" :class="{ 'is-private': !row.group_id }" :data-label="copy.source">{{ groupOf(row as never) }}</td>
          <td class="at-view">
            <NuxtLink class="rw-btn rw-btn--sm" :to="localePath(`/songs/${row.song_id}`)" :aria-label="`${copy.view} · ${row.song_title}`">{{ copy.view }}</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.at {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.at-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
.at-table th,
.at-table td {
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.at-table thead th {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}
.at-table tbody tr:last-child > td {
  border-bottom: 0;
}
.at-time {
  white-space: nowrap;
  color: var(--ink-2);
}
.at-song__link {
  display: grid;
  gap: 2px;
  color: inherit;
  text-decoration: none;
}
.at-song__link:hover .at-song__title {
  color: var(--link);
  text-decoration: underline;
}
.at-song__link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.at-song__title {
  font-weight: 600;
}
.at-song__id {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
/* the alias as a tag that wraps (aliases can be long; .rw-tag is one line) */
.at-alias {
  display: inline-block;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.at-user,
.at-group {
  color: var(--ink-2);
}
.at-group.is-private {
  color: var(--ink-3);
}
.at-view {
  text-align: right;
}
@media (max-width: 1099px) {
  .at-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .at-table,
  .at-table tbody,
  .at-table tr,
  .at-table td {
    display: block;
  }
  .at-table tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }
  .at-table tbody tr:last-child {
    border-bottom: 0;
  }
  .at-table td {
    padding: 0;
    border: 0;
  }
  .at-time {
    grid-column: 1 / -1;
    font-size: var(--fs-12);
  }
  .at-song {
    grid-column: 1;
  }
  .at-view {
    grid-column: 2;
    grid-row: 2 / span 2;
    align-self: center;
  }
  .at-table td:nth-child(3) {
    grid-column: 1;
  }
  .at-user,
  .at-group {
    grid-column: 1 / -1;
    font-size: var(--fs-13);
  }
  .at-user::before,
  .at-group::before {
    content: attr(data-label) " · ";
    color: var(--ink-3);
  }
}
</style>
