// Stable acceptance contract. Pixel rasterization remains a diagnostic; geometry,
// colors, controls, content and resource identities are independent hard gates.
export const CAPTURE_TIME = '2026-11-18T00:00:00.000Z';
export function resourceIdentity(value, base) {
  const url = new URL(value, base);
  // Legacy SongCoverImage's five-minute cache buster is not asset identity.
  // No other query (song id, variant, locale, etc.) is discarded.
  if (url.hostname === 'static.sakura-bot.cn' && /^\/cover\/\d+\.png$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get('v') || '')) url.searchParams.delete('v');
  return url.origin === new URL(base).origin ? url.pathname + url.search : url.href;
}
export function snapshotContract() {
  const props = ['display','position','color','background-color','background-image','opacity','font-family','font-size','font-weight','line-height','letter-spacing','text-align','white-space','overflow','overflow-x','overflow-y','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius','box-shadow','outline-color','outline-width','gap','align-items','justify-content','grid-template-columns','transform','z-index','fill','stroke','stroke-width','object-fit'];
  const nodes = [...document.querySelectorAll('body *')].filter(el => !el.closest('script,style,link,meta,#nuxt-devtools-container,#nuxt-devtools-anchor'));
  if (nodes.length > 4000) throw Error('DOM contract exceeds bounded capture budget');
  const records=[];
  for (const el of nodes) {
    const style=getComputedStyle(el), rect=el.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
    const pseudo=Object.fromEntries(['::before','::after'].map(part=>{const s=getComputedStyle(el,part);return [part,s.content==='none'?null:Object.fromEntries(['content',...props].map(k=>[k,s.getPropertyValue(k)]))];}));
    records.push({tag:el.tagName,pseudo,path:el.getAttribute('d'),viewBox:el.getAttribute('viewBox'),role:el.getAttribute('role'),label:el.getAttribute('aria-label'),href:el.getAttribute('href'),text,disabled:el.matches(':disabled'),checked:el.matches(':checked'),expanded:el.getAttribute('aria-expanded'),value:'value' in el && el.type!=='password'?String(el.value):null,rect:[rect.x,rect.y,rect.width,rect.height].map(n=>Math.round(n*64)/64),style:Object.fromEntries(props.map(k=>[k,style.getPropertyValue(k)]))});
  }
  return {schema:1,records,document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],images:[...document.images].map(el=>({src:el.currentSrc||el.src,complete:el.complete,loaded:el.naturalWidth>0,alt:el.alt})),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>`${f.family}|${f.weight}|${f.style}`).sort()};
}
export function compareContracts(a,b) {
  if (!a || !b || a.schema!==1 || b.schema!==1 || [a,b].some(x=>['records','document','images','fonts'].some(k=>!Array.isArray(x[k])))) return ['fresh DOM/layout contract required'];
  const problems=[];
  for (const key of ['records','document','images','fonts']) if(JSON.stringify(a[key])!==JSON.stringify(b[key])) problems.push(`contract ${key} differs`);
  return problems;
}
