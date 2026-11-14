import parseTJA from '../../vendor/tja-tools/src/js/parseTJA';
import drawChart, { initUsedSprite } from '../../vendor/tja-tools/src/js/drawChart';
import pixelFontUrl from '../../vendor/tja-tools/src/css/font/Pixel-3x5.ttf';
import { normalizeCatalogTja } from './catalog-normalize';

type Request = { text: string; course: string; side?: string; level: number; notes?: number; title: string; upload: string };
let ready: Promise<unknown> | undefined;

function initialize() {
  // Reject excessive geometry before the upstream canvas allocates its surface.
  for (const dimension of ['width', 'height'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension)!;
    const other = dimension === 'width' ? 'height' : 'width';
    Object.defineProperty(HTMLCanvasElement.prototype, dimension, { ...descriptor, set(value: number) {
      if (!Number.isFinite(value) || value <= 0 || value > 30000 || value * this[other] > 36000000)
        throw new Error('Chart exceeds bounded image geometry');
      descriptor.set!.call(this, value);
    } });
  }
  const font = new FontFace('Pixel 3x5', `url(${pixelFontUrl})`);
  return Promise.all([initUsedSprite(), font.load().then(face => document.fonts.add(face))]);
}

function parse(text: string) {
  // The pinned parser logs full chart trees; keep these out of browser consoles.
  const log = console.log;
  try { console.log = () => {}; return parseTJA(normalizeCatalogTja(text)); }
  finally { console.log = log; }
}

const courseNames = ['easy', 'normal', 'hard', 'oni', 'edit', 'tower', 'dan'];
export function inspectTjaImage(text: string) {
  const chart = parse(text);
  if (!chart.courses.length) throw new Error('invalid_tja');
  return { title: String(chart.headers.title || '').slice(0, 200), courses: chart.courses.map((course, index) => ({
    index, course: courseNames[course.headers.course] || 'unknown',
    side: course.headers.style > 1 ? `p${course.headers.startPlayer}` : 'single', level: Number(course.headers.level)
  })) };
}

export async function renderSelectedChart(text: string, index: number, title: string) {
  const chart = parse(text);
  if (!Number.isInteger(index) || !chart.courses[index]) throw new Error('invalid_tja');
  const course = chart.courses[index];
  // Bound layout work as well as canvas allocation for user supplied measures.
  if (course.measures.length > 2000) throw new Error('image_size');
  for (const measure of course.measures) {
    for (const length of [measure.length, measure.lengthNotes]) {
      if (!length || !length.every(value => Number.isFinite(value) && Math.abs(value) >= 1 / 1024 && Math.abs(value) <= 1024)
        || Math.abs(length[0] / length[1]) > 64) throw new Error('image_size');
    }
  }
  return renderParsedChart(chart, index, title);
}

async function renderParsedChart(chart: ReturnType<typeof parse>, index: number, title: string) {
  await (ready ||= initialize());
  const course = chart.courses[index];
  chart.headers.title = title.slice(0, 200);
  chart.headers.font = 'sans-serif';
  course.headers.ttRowBeat = 16;
  const canvas = drawChart(chart, index);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
    if (blob.size > 12 * 1024 * 1024) throw new Error('PNG exceeds image budget');
    return { blob, width: canvas.width, height: canvas.height, bytes: blob.size, title: chart.headers.title };
  } finally { canvas.width = 1; canvas.height = 1; }
}

export async function renderCatalogChart(input: Request) {
  const chart = parse(input.text);
  const difficulty = ['easy', 'normal', 'hard', 'oni', 'edit'].indexOf(input.course);
  const side = input.side || 'single';
  const candidates = chart.courses.map((course, index) => ({ course, index })).filter(({ course }) =>
    course.headers.course === difficulty && (course.headers.style > 1 ? `p${course.headers.startPlayer}` : 'single') === side);
  if (candidates.length !== 1) throw new Error('Requested course/player side unavailable or ambiguous');
  const { course, index } = candidates[0]!;
  if (Number(course.headers.level) !== input.level) throw new Error('Course star identity mismatch');
  let notes = 0;
  let branch = 'N';
  for (const [measureIndex, measure] of course.measures.entries()) {
    if (measure.events.some(event => event.name === 'branchEnd' && event.position === 0)) branch = 'N';
    if (measure.events.some(event => event.name === 'branchStart')) {
      let end = measureIndex + 1;
      while (end < course.measures.length && !course.measures[end].events.some(event => ['branchStart', 'branchEnd'].includes(event.name) && event.position === 0)) {
        if (course.measures[end].events.some(event => event.name === 'branchEnd')) { end++; break; }
        end++;
      }
      branch = ['M', 'E', 'N'].find(name => course.measures.slice(measureIndex, end).some(bar => bar.data[name] !== null)) || 'N';
    }
    // An absent final measure in one branch stays absent; it is not normal notes.
    for (const note of measure.data[branch] || []) {
      if (['don', 'kat', 'donBig', 'katBig'].includes(note.type)) notes++;
    }
  }
  if (input.notes && notes !== input.notes) throw new Error(`Note identity mismatch: ${notes}/${input.notes}`);
  // The batch publisher and interactive tool share the exact same renderer.
  const { blob, ...metadata } = await renderParsedChart(chart, index, input.title);
  const response = await fetch(input.upload, { method: 'POST', body: blob, headers: { 'Content-Type': 'image/png' } });
  if (!response.ok) throw new Error('PNG publication failed');
  return { ...metadata, notes };
}
