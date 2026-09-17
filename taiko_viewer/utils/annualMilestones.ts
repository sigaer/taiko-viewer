// Presentation only: retain the original winning event (including its time/counts).
export const annualMilestonePriority: Record<string, number> = { clear: 1, full_combo: 2, dondaful: 3 };
export const selectAnnualHighlights = <T extends { type: string; song: { songNo: number; level?: number | null }; level?: number | null }>(items: T[]): T[] => {
  const selected = new Map<string, T>();
  for (const item of items) {
    if (!annualMilestonePriority[item.type]) continue;
    const key = `${item.song.songNo}:${item.level ?? item.song.level}`;
    const previous = selected.get(key);
    if (!previous || annualMilestonePriority[item.type] > annualMilestonePriority[previous.type]) selected.set(key, item);
  }
  return [...selected.values()].sort((a, b) => annualMilestonePriority[a.type] - annualMilestonePriority[b.type]);
};
