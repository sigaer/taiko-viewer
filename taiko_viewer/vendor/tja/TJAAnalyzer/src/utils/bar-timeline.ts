/** Integrate source-ordered timing commands over a bar's slot boundaries. */
export function barIntervalMs(params: {
  initialBpm: number; measureRatio: number;
  bpmChanges?: { index: number; bpm: number }[];
  delayChanges?: { index: number; seconds: number }[];
}, slots: number, start: number, end: number, includeStartDelay = false): number {
  let bpm = params.initialBpm;
  let cursor = start;
  let milliseconds = 0;
  const scale = 240000 * params.measureRatio / slots;
  for (const change of params.bpmChanges ?? []) {
    if (change.index <= start) { bpm = change.bpm; continue; }
    if (change.index >= end) break;
    milliseconds += (change.index - cursor) * scale / bpm;
    cursor = change.index;
    bpm = change.bpm;
  }
  milliseconds += (end - cursor) * scale / bpm;
  for (const change of params.delayChanges ?? []) {
    if ((includeStartDelay ? change.index >= start : change.index > start) && change.index <= end)
      milliseconds += change.seconds * 1000;
  }
  return milliseconds;
}
