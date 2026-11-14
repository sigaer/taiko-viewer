import { inspectTjaImage, renderSelectedChart } from './chart-image';

let text = '';
let busy = false;
function decode(file: Blob, encoding: string) {
  return file.arrayBuffer().then(bytes => {
    const choices = encoding === 'auto' ? ['utf-8', 'shift_jis', 'gb18030']
      : [({ 'utf-8-sig': 'utf-8', cp932: 'shift_jis', gb18030: 'gb18030' } as Record<string, string>)[encoding]];
    for (const codec of choices) {
      if (!codec) break;
      try { return new TextDecoder(codec, { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); } catch {}
    }
    throw new Error('encoding');
  });
}
function validate(text: string) {
  if (text.includes('\0')) throw new Error('invalid_tja');
  let inside = false, count = 0;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.split('//')[0].trim();
    if (/^#MEASURE\s/i.test(line)) {
      const lengths = line.replace(/^#MEASURE\s+/i, '').replace(/,$/, '').split(',');
      if (lengths.length > 2 || lengths.some(length => {
        const pair = length.split('/').map(Number);
        return pair.length !== 2 || pair.some(value => !Number.isFinite(value) || Math.abs(value) < 1 / 1024 || Math.abs(value) > 1024)
          || Math.abs(pair[0] / pair[1]) > 64;
      })) throw new Error('image_size');
    }
    if (/^#START(?:\s|$)/i.test(line)) {
      if (inside) throw new Error('invalid_tja');
      inside = true;
      if (++count > 12) throw new Error('chart_limit');
    } else if (/^#END$/i.test(line)) {
      if (!inside) throw new Error('invalid_tja');
      inside = false;
    }
  }
  if (!count || inside) throw new Error('invalid_tja');
}

window.addEventListener('message', async event => {
  if (event.source !== parent || busy || !event.data || typeof event.data.id !== 'string') return;
  const { id, action } = event.data;
  busy = true;
  try {
    let result;
    if (action === 'inspect') {
      text = '';
      const file = event.data.file;
      if (!(file instanceof Blob) || !file.size || file.size > 512 * 1024) throw new Error('file_size');
      const candidate = await decode(file, event.data.encoding);
      validate(candidate);
      result = inspectTjaImage(candidate);
      text = candidate;
    } else if (action === 'render' && text) {
      result = await renderSelectedChart(text, event.data.index, String(event.data.title || ''));
    } else throw new Error('invalid_tja');
    parent.postMessage({ id, result }, '*');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = ['encoding', 'invalid_tja', 'file_size', 'chart_limit', 'image_size'].includes(message) ? message
      : /geometry|budget/.test(message) ? 'image_size' : 'image_failed';
    parent.postMessage({ id, error: code }, '*');
  } finally { busy = false; }
});
parent.postMessage({ type: 'tja-image-ready' }, '*');
