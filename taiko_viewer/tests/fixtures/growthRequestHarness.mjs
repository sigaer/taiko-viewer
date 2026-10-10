// Offline service adapter: real disk evidence, Daily/History/Passport algorithms;
// no DB, Python subprocess, network, real account, or final-DTO replacement.
import * as fs from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
export async function importGrowthRequest(fixture, { baseline = false, migrationBaseline = false, binding = null, failPython = false, onPython = null, onHistoryRead = null, onHistoryStat = null, onHistoryEnumerate = null } = {}) {
  const counters = { enumeration: 0, reads: 0, parseAttempts: 0, parses: 0, bytes: 0, normalization: 0, daily: 0, range: 0, scoreFacts: 0, currentReads: 0, archiveReads: 0, measurementWrites: 0,
    loaderMs: 0, readMs: 0, readBatchMs: 0, parseMs: 0, dailyMs: 0, rangeMs: 0, scoreFactsMs: 0 };
  const key = `growth_request_${crypto.randomUUID().replaceAll('-', '_')}`;
  const currentPath = resolve(fixture.userdataDir, `${fixture.id}data.json`);
  await fs.writeFile(currentPath, JSON.stringify({ songs: fixture.current }));
  const defaultBinding = { id: 1, taiko_id: fixture.id, source: 'wahlap' };
  const dimensions = ['big_song','stamina','speed','accuracy_power','rhythm','complex'].map(key => ({ key, value: 10 }));
  const state = {
    counters,
    shared: { getCurrentBindingRow: async () => binding ? binding() : defaultBinding,
      getRuntimePaths: () => ({ userdataDir: fixture.userdataDir }), getUserdataPath: () => currentPath },
    // Services pass this inert sentinel only to the explicitly replaced repositories.
    safeDb: { getAccountDb: () => null },
    content: { getSongCatalog: async () => fixture.current.map(row => ({ id: row.song_no, song_name: `synthetic-${row.song_no}`, level_4: 10, level_5: 10 })) },
    personal: { runGrowthPythonJson: async () => {
      if (onPython) await onPython();
      if (failPython) throw new Error('Offline compute failure');
      return { playerState: { dimensions, sampleCount: 30, overallRating: 10 }, todayPlan: { items: [], usedFallback: false } };
    } },
    goalStore: { readActiveGoal: async () => null },
    goalEvaluation: { readRecentCompletedGoal: async () => null },
    goalFacts: { loadGoalFacts: async () => fixture.goalFacts || [] },
    model: { getGrowthModelRevision: async () => 'fixture-model' },
    provenance: { verifiedGoalProvenance: () => null },
    measurements: { readGrowthMeasurements: async () => fixture.measurements || [], readDailyGrowthMeasurements: async () => fixture.measurements || [],
      readGrowthMeasurementCoverage: async () => ({ measurementFrom: null, measurementTo: null, measurementDays: 0 }),
      upsertGrowthMeasurement: async () => { counters.measurementWrites++; return { created: false }; } },
    fs: { ...fs, readdir: async (...args) => { counters.enumeration++; if (onHistoryEnumerate) await onHistoryEnumerate(String(args[0])); return fs.readdir(...args); },
      stat: async (...args) => {
        if (onHistoryStat) await onHistoryStat(String(args[0]));
        return fs.stat(...args);
      },
      readFile: async (...args) => {
        const path = String(args[0]);
        if (/\/data_.*\.json$/.test(path)) {
          counters.reads++;
          if (onHistoryRead) await onHistoryRead(path);
        }
        if (path === currentPath) counters.currentReads++;
        return fs.readFile(...args);
      },
      open: async (...args) => { if (String(args[0]).endsWith('daily-ability-v1-top20.json')) counters.archiveReads++; return fs.open(...args); } }
  };
  globalThis[key] = state;
  const stub = name => url(Object.keys(state[name]).filter(exportName => exportName !== 'default').map(exportName => `export const ${exportName}=globalThis[${JSON.stringify(key)}][${JSON.stringify(name)}][${JSON.stringify(exportName)}];`).join('\n'));
  const overrides = new Map([
    ['server/internal/account/shared.ts', 'shared'], ['server/utils/account-db.ts', 'safeDb'], ['server/services/content.ts', 'content'],
    ['server/services/account/personal.ts', 'personal'], ['server/services/goals/store.ts', 'goalStore'],
    ['server/services/goals/evaluation-store.ts', 'goalEvaluation'], ['server/services/growth-history/goals.ts', 'goalFacts'],
    ['server/services/growth-history/model-revision.ts', 'model'], ['server/services/growth-history/measurements.ts', 'measurements'],
    ['server/services/goals/provenance.ts', 'provenance']
  ].map(([path, name]) => [resolve(root, path), stub(name)]));
  const cache = new Map();
  const load = async path => {
    if (overrides.has(path)) return overrides.get(path);
    if (cache.has(path)) return cache.get(path);
    let source = await fs.readFile(path, 'utf8');
    const relative = path.slice(root.length);
    if (migrationBaseline) {
      source = execFileSync('git', ['show', `060dc05:taiko_viewer/${relative}`], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    }
    const frozen = { 'utils/dailyProgress.ts': 'dailyProgress', 'server/services/growth-history/evidence.ts': 'evidence', 'server/services/growth-passport/service.ts': 'service' };
    if (baseline && frozen[relative]) source = await fs.readFile(resolve(root, 'tests/fixtures/passport0819', `${frozen[relative]}.ts.txt`), 'utf8');
    const insert = (anchor, replacement) => {
      if (source.split(anchor).length !== 2) throw new Error(`Instrumentation anchor changed: ${relative}`);
      source = source.replace(anchor, replacement);
    };
    if (relative === 'server/services/growth-history/evidence.ts') {
      const readAnchor = source.includes('const raw = await reader.readHistory') ? 'const raw = await reader.readHistory(taikoId, name);' : 'const raw = await readFile(resolve(directory, name), "utf-8");';
      insert(readAnchor, `const readStarted = performance.now(); ${readAnchor} __counts.readMs += performance.now() - readStarted;`);
      insert('const payload = JSON.parse(raw) as UserdataPayload;', '__counts.parseAttempts++; __counts.bytes += Buffer.byteLength(raw); const parseStarted = performance.now(); let payload: UserdataPayload; try { payload = JSON.parse(raw) as UserdataPayload; __counts.parses++; } finally { __counts.parseMs += performance.now() - parseStarted; }');
      insert('const snapshots: GrowthSnapshot[] = [];', '__counts.normalization++; const snapshots: GrowthSnapshot[] = [];');
      if (source.includes('async function* readHistoryFiles')) {
        insert('    const batch = await Promise.all', '    const batchStarted=performance.now(); const batch = await Promise.all');
        insert('    for (const file of batch) yield file;', '    __counts.readBatchMs += performance.now()-batchStarted; for (const file of batch) yield file;');
      }
      insert('async function readGrowthScoreEvidence(', 'async function readGrowthScoreEvidenceInner(');
      source += '\nasync function readGrowthScoreEvidence(...args: Parameters<typeof readGrowthScoreEvidenceInner>) { const started=performance.now(); try { return await readGrowthScoreEvidenceInner(...args); } finally { __counts.loaderMs += performance.now()-started; } }';
    }
    if (relative === 'utils/dailyProgress.ts') {
      insert("  const derived = deriveProgressForRange", "  __counts.daily++; const derived = deriveProgressForRange");
      insert('  return deriveProgressForCalendarDays', '  __counts.range++; return deriveProgressForCalendarDays');
      for (const [name, timing] of [['deriveDailyProgress','dailyMs'],['deriveProgressForRange','rangeMs']]) {
        insert(`export function ${name}(`, `function ${name}Inner(`);
        source += `\nexport function ${name}(...args: Parameters<typeof ${name}Inner>) { const started=performance.now(); try { return ${name}Inner(...args); } finally { __counts.${timing} += performance.now()-started; } }`;
      }
    }
    if (relative === 'utils/growthHistory.ts') {
      insert('export function projectScoreFacts(', 'function projectScoreFactsInner(');
      source += '\nexport function projectScoreFacts(...args: Parameters<typeof projectScoreFactsInner>) { __counts.scoreFacts++; const started=performance.now(); try { return projectScoreFactsInner(...args); } finally { __counts.scoreFactsMs += performance.now()-started; } }';
    }
    let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    code = `const __counts=globalThis[${JSON.stringify(key)}].counters; const Date=class extends globalThis.Date { constructor(...args){super(...(args.length?args:[${JSON.stringify(fixture.clock || '2026-10-08T05:00:00Z')}]))} static now(){return new Date().getTime()} };\n` + code;
    for (const match of [...code.matchAll(/from (["'])([^"']+)\1/g)]) {
      const specifier = match[2];
      let dependency = specifier;
      if (specifier === 'node:fs/promises') dependency = stub('fs');
      else if (specifier === 'h3') dependency = url('export const createError=options=>Object.assign(new Error(options.statusMessage),options);');
      else if (specifier.startsWith('.') || specifier.startsWith('~/')) {
        let target = specifier.startsWith('~/') ? resolve(root, specifier.slice(2)) : resolve(dirname(path), specifier);
        if (!/\.(ts|mjs|js)$/.test(target)) target += '.ts';
        dependency = await load(target);
      } else if (specifier === '@sakura-taiko/contract') dependency = import.meta.resolve(specifier);
      else if (!specifier.startsWith('node:')) throw new Error(`Unexpected offline dependency: ${specifier}`);
      code = code.replace(match[0], `from ${JSON.stringify(dependency)}`);
    }
    const result = url(code); cache.set(path, result); return result;
  };
  try {
    const service = await import(await load(resolve(root, 'server/services/growth-passport/service.ts')));
    const evidence = await import(await load(resolve(root, 'server/services/growth-history/evidence.ts')));
    return { service, evidence, counters, dispose: () => { delete globalThis[key]; } };
  } catch (error) { delete globalThis[key]; throw error; }
}
