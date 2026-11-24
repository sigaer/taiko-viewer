import * as Renderer from "tja-renderer";

import { barIntervalMs } from "./bar-timeline.js";

const { RENDERABLE_NOTES, NoteType } = Renderer.Private;
type ParsedChart = Renderer.Private.ParsedChart;

const LONG_NOTE_TYPES = [NoteType.Drumroll, NoteType.DrumrollBig, NoteType.Balloon, NoteType.Kusudama, NoteType.End];

/**
 * How to handle long notes (drumrolls, balloons, kusudama) when measuring gaps.
 * - End: stop at the End marker of a long note (default)
 * - Start: skip End markers, stop at the long note start (Drumroll/Balloon/etc.)
 * - Skip: skip the entire long note, find the previous judgeable note
 * - Strict: return null if a long note is encountered before a judgeable note
 */
export enum LongNoteHandling {
  End = "end",
  Start = "start",
  Skip = "skip",
  Strict = "strict",
}

export interface GapOptions {
  /** How to handle long notes when measuring gaps. Defaults to LongNoteHandling.End. */
  longNoteHandling?: LongNoteHandling;
  /** Maximum gap in measures before returning null. Defaults to no limit. */
  maxMeasures?: number;
}

interface BarSegment {
  fraction: number;
  milliseconds: number;
}

function getGapSegments(
  chart: ParsedChart, currentBarIdx: number, currentCharIdx: number, options: GapOptions = {},
): BarSegment[] | null {
  const { longNoteHandling = LongNoteHandling.End, maxMeasures } = options;
  const segments: BarSegment[] = [];
  let totalMeasures = 0;
  for (let b = currentBarIdx; b >= 0; b--) {
    const bar = chart.bars[b];
    const params = chart.barParams?.[b];
    if (!bar || !params) return null;
    const slots = bar.length || 1; // A bare comma still lasts one measure.
    const end = b === currentBarIdx ? currentCharIdx : slots;
    let start = 0;
    let found = false;
    for (let i = Math.min(end - 1, bar.length - 1); i >= 0; i--) {
      if (!RENDERABLE_NOTES.includes(bar[i])) continue;
      if (LONG_NOTE_TYPES.includes(bar[i])) {
        if (longNoteHandling === LongNoteHandling.Strict) return null;
        if (longNoteHandling === LongNoteHandling.Skip) continue;
        if (longNoteHandling === LongNoteHandling.Start && bar[i] === NoteType.End) continue;
      }
      start = i;
      found = true;
      break;
    }
    const fraction = (end - start) / slots * params.measureRatio;
    totalMeasures += fraction;
    if (maxMeasures !== undefined && totalMeasures > maxMeasures + 1e-9) return null;
    segments.push({ fraction, milliseconds: barIntervalMs(params, slots, start, end, !found) });
    if (found) return segments;
  }
  return null;
}

/** Get gap to previous renderable note in measure fractions. */
export function getGapMeasures(
  chart: ParsedChart,
  barIdx: number,
  charIdx: number,
  options: GapOptions = {},
): number | null {
  const segments = getGapSegments(chart, barIdx, charIdx, options);
  if (!segments) return null;
  let total = 0;
  for (const seg of segments) {
    total += seg.fraction;
  }
  return total;
}

/** Get gap to previous renderable note in milliseconds, using per-bar BPM. */
export function getGapMs(chart: ParsedChart, barIdx: number, charIdx: number, options: GapOptions = {}): number | null {
  const segments = getGapSegments(chart, barIdx, charIdx, options);
  if (!segments) return null;
  let totalMs = 0;
  for (const seg of segments) {
    totalMs += seg.milliseconds;
  }
  return totalMs;
}
