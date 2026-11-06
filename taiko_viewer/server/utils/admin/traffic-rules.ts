import { createHmac } from 'node:crypto';
import { parseNginxLogTime } from './dashboard-time';

export const TRAFFIC_SOURCE = 'viewer_access_v2';
export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const REASONS = {
  method: '非页面方法', api: '接口请求', resource: '静态资源', probe: '扫描路径',
  bot: '已知自动化', missingUa: '缺少浏览器标识', status: '错误或重定向响应',
  unknownRoute: '非页面路径', burst: '疑似高频访问', repeat: '疑似重复抓取',
  scanBehavior: '疑似扫描行为', capacity: '超出统计容量'
} as const;
export type Reason = keyof typeof REASONS;
type Visitor = { ip: string; pv: number; home: number; paths: Record<string, number>; requests: number; errors: number; probes: number };
export type TrafficMinute = { raw: number; reasons: Partial<Record<Reason, number>>; visitors: Record<string, Visitor> };
export type AccessRequest = { ip: string; time: number; method: string; path: string; status: number; ua: string };
export const emptyMinute = (): TrafficMinute => ({ raw: 0, reasons: {}, visitors: {} });
export const trafficHash = (salt: string, value: string) => createHmac('sha256', salt).update(value).digest('hex').slice(0, 32);

export function parseAccessLine(line: string): AccessRequest | null {
  const m = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+) [^"]+" (\d{3}) \S+ "[^"]*" "([^"]*)"/);
  if (!m) return null;
  const time = parseNginxLogTime(m[2]);
  if (!time) return null;
  let path: string;
  try { path = decodeURIComponent(new URL(m[4], 'https://viewer.sakura-bot.cn').pathname); }
  catch { path = m[4].split('?')[0]; }
  return { ip: m[1], time: time.getTime(), method: m[3], path, status: Number(m[5]), ua: m[6] };
}

// Compiled from the shipped Nuxt page files at build time. A new page is included
// automatically; a successful scanner URL or a resource cannot become a page.
export function pageRoutePattern(file: string) {
  const path = file.replace(/\.vue$/, '').replace(/(^|\/)index$/, '');
  if (!path) return '^(?:/|/ja/?)$';
  const escaped = path.split(/(\[\[?[^\]]+\]\]?)/g).map(part => {
    if (part.startsWith('[...')) return '.+';
    if (part.startsWith('[[')) return '[^/]*';
    if (part.startsWith('[')) return '[^/]+';
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return `^(?:/ja)?/${escaped}/?$`;
}

export function exclusionReason(r: AccessRequest, routes: RegExp[]): Reason | null {
  if (r.method !== 'GET') return 'method';
  if (/^\/(?:api|taiko-api)(?:\/|$)/i.test(r.path)) return 'api';
  if (/(?:^|\/)(?:\.env|\.git|wp-admin|wp-login|wordpress|phpmyadmin|cgi-bin|actuator)(?:\/|\.|$)|\.php(?:\/|$)/i.test(r.path)) return 'probe';
  if (/^\/(?:_nuxt|_ipx|qqbot-cache|assets|images|fonts)(?:\/|$)/i.test(r.path) ||
      /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|m?js|cjs|map|woff2?|ttf|otf|eot|txt|xml|json|mp[34]|m4a|ogg|wav|webm|pdf|zip|wasm|webmanifest)$/i.test(r.path)) return 'resource';
  if (/(bot|spider|crawl|headless|scan|zgrab|python|curl|wget|go-http-client|httpclient|libredtail|semrush|^node(?:\/|$)|undici|axios|okhttp|postman)/i.test(r.ua)) return 'bot';
  if (!r.ua.trim() || r.ua === '-') return 'missingUa';
  if (((r.status < 200 || r.status >= 300) && r.status !== 304) || r.status === 204 || r.status === 206) return 'status';
  if (!routes.some(pattern => pattern.test(r.path))) return 'unknownRoute';
  return null;
}

export function addRequest(bucket: TrafficMinute, r: AccessRequest, salt: string, routes: RegExp[]) {
  bucket.raw++;
  const reason = exclusionReason(r, routes);
  if (reason) bucket.reasons[reason] = (bucket.reasons[reason] || 0) + 1;
  // Only page/probe/error traffic contributes to behavior, never asset fan-out
  // or API polling. IP + UA reduces shared-network false positives.
  if (reason && !['probe', 'status', 'unknownRoute'].includes(reason)) return;
  const ip = trafficHash(salt, r.ip);
  const key = trafficHash(salt, `${r.ip}\n${r.ua}`);
  let visitor = bucket.visitors[key];
  if (!visitor) {
    if (Object.keys(bucket.visitors).length >= 1000) {
      if (!reason) bucket.reasons.capacity = (bucket.reasons.capacity || 0) + 1;
      return;
    }
    visitor = bucket.visitors[key] = { ip, pv: 0, home: 0, paths: {}, requests: 0, errors: 0, probes: 0 };
  }
  visitor.requests++;
  if (r.status >= 400) visitor.errors++;
  if (reason === 'probe') visitor.probes++;
  if (reason) return;
  visitor.pv++;
  if (['/', '/ja', '/ja/'].includes(r.path)) visitor.home++;
  const pathKey = trafficHash(salt, r.path);
  if (pathKey in visitor.paths || Object.keys(visitor.paths).length < 60) {
    visitor.paths[pathKey] = (visitor.paths[pathKey] || 0) + 1;
  }
}

export function summarizeMinute(bucket: TrafficMinute) {
  let pv = 0, homePv = 0, suspected = 0;
  const ips = new Set<string>();
  const reasons = { ...bucket.reasons };
  for (const v of Object.values(bucket.visitors)) {
    // Recomputed over the whole minute, including earlier batches. Detection
    // therefore does not accidentally count the first N requests as human.
    const reason: Reason | null = v.probes >= 10 || (v.requests >= 20 && v.errors / v.requests >= .8)
      ? 'scanBehavior' : v.pv >= 60 ? 'burst'
        : Object.values(v.paths).some(count => count >= 20) ? 'repeat' : null;
    if (reason) { suspected += v.pv; reasons[reason] = (reasons[reason] || 0) + v.pv; }
    else if (v.pv) { pv += v.pv; homePv += v.home; ips.add(v.ip); }
  }
  return { raw: bucket.raw, pv, homePv, ips, suspected, excluded: bucket.raw - pv - suspected, reasons };
}
