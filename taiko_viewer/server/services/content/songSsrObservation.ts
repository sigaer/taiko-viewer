type ErrorRecord = {
  atUtc: string;
  songId: number;
  difficulty: number | null;
  locale: "zh" | "ja";
  category: string;
  failure: string;
  stack: string[];
};

const errorCategories = new Set([
  "Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "FetchError", "H3Error"
]);

// Only code locations survive. Error text, request values and absolute host
// paths must never become production diagnostics.
const codeStack = (stack: unknown): string[] => {
  if (typeof stack !== "string") return [];
  const frames: string[] = [];
  for (const line of stack.slice(0, 8192).split("\n").slice(1, 25)) {
    const match = line.match(/\/(server\/chunks\/[A-Za-z0-9_./@-]+\.(?:m?js|ts|vue)|node_modules\/[A-Za-z0-9_./@-]+\.(?:m?js|ts)):(\d{1,7}):(\d{1,7})(?:\)|$)/);
    if (!match || match[1].includes("..")) continue;
    frames.push(`${match[1]}:${match[2]}:${match[3]}`);
    if (frames.length === 6) break;
  }
  return frames;
};

export const createSongSsrObserver = (
  emit: (record: ErrorRecord) => void,
  now: () => number = Date.now
) => {
  let minute = -1;
  let inMinute = 0;
  let total = 0;
  const seen = new WeakSet<object>();
  return (error: unknown, event: object & { path?: string }) => {
    if (total >= 100 || seen.has(event) || typeof event.path !== "string" || event.path.length > 2048) return;
    let url: URL;
    try { url = new URL(event.path, "http://ssr.invalid"); } catch { return; }
    const route = url.pathname.match(/^\/(ja\/)?songs\/([1-9]\d{0,8})\/?$/);
    if (!route) return;
    const timestamp = now();
    const currentMinute = Math.floor(timestamp / 60000);
    if (minute !== currentMinute) { minute = currentMinute; inMinute = 0; }
    if (inMinute >= 5) return;
    const value = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; stack?: unknown } : {};
    const message = typeof value.message === "string" ? value.message.slice(0, 1024) : "";
    const failure = message.includes("instance unavailable") ? "nuxt-context-unavailable"
      : /Cannot read properties of (?:null|undefined)/.test(message) ? "missing-value-read"
      : message.includes("is not a function") ? "invalid-call"
      : "unclassified";
    const query = url.searchParams.getAll("difficulty");
    const difficulty = query.length === 1 && /^[1-5]$/.test(query[0]) ? Number(query[0]) : null;
    const stackCategory = typeof value.stack === "string" ? value.stack.slice(0, 80).match(/^([A-Za-z]+Error):/)?.[1] : undefined;
    const category = stackCategory && errorCategories.has(stackCategory) ? stackCategory
      : typeof value.name === "string" && errorCategories.has(value.name) ? value.name : "Error";
    const record: ErrorRecord = {
      atUtc: new Date(timestamp).toISOString(), songId: Number(route[2]),
      difficulty, locale: route[1] ? "ja" : "zh",
      category,
      failure, stack: codeStack(value.stack)
    };
    seen.add(event);
    inMinute++;
    total++;
    emit(record);
  };
};
