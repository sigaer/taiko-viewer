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

export async function renderCatalogChart(input: Request) {
  await (ready ||= initialize());
  const chart = parseTJA(normalizeCatalogTja(input.text));
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
  // Only presentation changes; the verified original file stays byte-identical.
  chart.headers.title = input.title;
  chart.headers.font = 'sans-serif';
  course.headers.ttRowBeat = 16;
  const canvas = drawChart(chart, index);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
    if (blob.size > 12 * 1024 * 1024) throw new Error('PNG exceeds image budget');
    const response = await fetch(input.upload, { method: 'POST', body: blob, headers: { 'Content-Type': 'image/png' } });
    if (!response.ok) throw new Error('PNG publication failed');
    return { width: canvas.width, height: canvas.height, bytes: blob.size, notes, title: chart.headers.title };
  } finally { canvas.width = 1; canvas.height = 1; }
}
