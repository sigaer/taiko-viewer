export const PLAYER_CHANNEL = "ourtaiko-view";
export const PRACTICE_COURSES = ["Easy", "Normal", "Hard", "Oni", "Edit"] as const;

export const playerMessage = (type: string, requestId: string, payload?: unknown) => ({
  channel: PLAYER_CHANNEL, version: 1, type, requestId, ...(payload ? { payload } : {})
});

export const isPracticeMessage = (event: MessageEvent, source: Window | null, origin: string) =>
  source !== null && event.source === source && event.origin === origin &&
  event.data?.channel === PLAYER_CHANNEL && event.data?.version === 1 &&
  typeof event.data?.type === "string";

// TJA COURSE numbers are zero-based; Viewer difficulty IDs are one-based.
export function hasPracticeCourse(chartText: string, difficulty: number): boolean {
  let course = "oni";
  const target = PRACTICE_COURSES[difficulty - 1]?.toLowerCase();
  if (!target) return false;
  for (const raw of chartText.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    const match = /^COURSE\s*:\s*(\S+)/i.exec(line);
    if (match) {
      const value = match[1].toLowerCase();
      course = /^\d$/.test(value) ? (PRACTICE_COURSES[Number(value)]?.toLowerCase() || "") : value;
    }
    if (/^#START(?:\s|$)/i.test(line) && course === target) return true;
  }
  return false;
}
