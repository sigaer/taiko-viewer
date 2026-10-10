// Offline-only import adapter. Production algorithms run from their actual source;
// only runtime paths, the frozen calendar oracle and benchmark hooks are injected.
import { readFile } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
export async function importGrowthModule(relative, { userdataDir, before = false, hooks = null } = {}) {
  const cache = new Map();
  const hookKey = `growth_bench_${crypto.randomUUID().replaceAll("-", "_")}`;
  if (hooks) globalThis[hookKey] = hooks;
  const load = async path => {
    if (cache.has(path)) return cache.get(path);
    if (path === resolve(root, "server/internal/account/shared.ts")) {
      if (!userdataDir) throw new Error("Offline evidence requires injected paths");
      return dataUrl(`export const getRuntimePaths=()=>({userdataDir:${JSON.stringify(userdataDir)}});`);
    }
    let source = await readFile(path, "utf8");
    if (before && path === resolve(root, "utils/playerGrowth.ts")) {
      const marker = source.indexOf("// One fixed-zone formatter");
      if (marker < 0) throw new Error("Calendar oracle replacement anchor changed");
      source = source.slice(0, marker) + `\nexport {growthCalendarDayBefore as growthCalendarDay} from ${JSON.stringify(new URL("../../tests/fixtures/growthCalendarBefore0800.mjs", import.meta.url).href)};`;
    }
    if (hooks && path === resolve(root, "server/services/growth-history/evidence.ts")) {
      // Instrument interleaved phases; do not pretend normalization happens after loading.
      const replace = (anchor, code) => {
        if (source.split(anchor).length !== 2) throw new Error("Evidence instrumentation anchor changed");
        source = source.replace(anchor, code);
      };
      replace("const snapshots: GrowthSnapshot[] = [];", "__bench.enumerated(allNames.length, names.length);\n  const snapshots: GrowthSnapshot[] = [];");
      const loop = source.includes('for await (const { name, raw } of readHistoryFiles(reader, taikoId, names)) {')
        ? 'for await (const { name, raw } of readHistoryFiles(reader, taikoId, names)) {' : source.includes('for await (const { name, raw } of readHistoryFiles(directory, names)) {')
        ? 'for await (const { name, raw } of readHistoryFiles(directory, names)) {' : 'for (const name of names) {';
      replace(loop, `${loop}\n    __bench.fileStart();`);
      if (source.includes('async function* readHistoryFiles')) {
        replace('    const batch = await Promise.all', '    __bench.batchStart(); const batch = await Promise.all');
        replace('    for (const file of batch) yield file;', '    __bench.batchDone(); for (const file of batch) yield file;');
      }
      replace("const payload = JSON.parse(raw) as UserdataPayload;", "__bench.rawRead(Buffer.byteLength(raw));\n      const payload = JSON.parse(raw) as UserdataPayload;\n      __bench.parsed(payload.songs?.length || 0);");
      replace("const days = snapshots.map", "__bench.loaded(snapshots.length, invalidFiles);\n  const days = snapshots.map");
      replace("  }\n  __bench.loaded", "    finally { __bench.fileDone(snapshots.length, invalidFiles, observations.length, observations.at(-1)?.evidenceLevel); }\n  }\n  __bench.loaded");
      source = `const __bench=globalThis[${JSON.stringify(hookKey)}];\n` + source;
    }
    let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const matches = [...code.matchAll(/from (["'])([^"']+)\1/g)];
    for (const match of matches) {
      const specifier = match[2];
      let url = specifier;
      if (specifier.startsWith("~/") || specifier.startsWith(".")) {
        let dependency = specifier.startsWith("~/") ? resolve(root, specifier.slice(2)) : resolve(dirname(path), specifier);
        if (!/\.(ts|mjs|js)$/.test(dependency)) dependency += ".ts";
        if (!isAbsolute(dependency) || !dependency.startsWith(root)) throw new Error("Unexpected dependency");
        url = await load(dependency);
      } else if (!specifier.startsWith("node:") && !specifier.startsWith("file:")) url = import.meta.resolve(specifier);
      code = code.replace(match[0], `from ${JSON.stringify(url)}`);
    }
    const url = dataUrl(code); cache.set(path, url); return url;
  };
  return import(await load(resolve(root, relative)));
}
