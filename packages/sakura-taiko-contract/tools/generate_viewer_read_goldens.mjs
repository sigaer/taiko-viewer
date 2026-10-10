// Freeze original Viewer decoders, not the replacement implementations.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from '../../../taiko_viewer/node_modules/typescript/lib/typescript.js';

const revision = '060dc05';
const files = {
  daily: 'taiko_viewer/utils/dailyProgress.ts', goal: 'taiko_viewer/utils/playerGoal.ts',
  evidence: 'taiko_viewer/server/services/growth-history/evidence.ts',
  overview: 'taiko_viewer/server/services/account/growth.ts', display: 'taiko_viewer/server/internal/account/shared.ts'
};
const sources = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 })]));
function extract(source, names) {
  const file = ts.createSourceFile('legacy.ts', source, ts.ScriptTarget.Latest, true);
  const selected = new Map();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations) {
      const name = decl.name.getText(file);
      if (names.includes(name)) selected.set(name, `const ${decl.getText(file)};`);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name && names.includes(statement.name.text)) selected.set(statement.name.text, statement.getText(file));
  }
  if (selected.size !== names.length) throw new Error('Frozen decoder extraction mismatch');
  const code = names.map(name => selected.get(name)).join('\n') + `\nexport { ${names.join(',')} };`;
  return ts.transpileModule(code.replace(/export function /g, 'function '), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const load = async (name, names) => import(`data:text/javascript;base64,${Buffer.from(extract(sources[name], names)).toString('base64')}`);
const daily = await load('daily', ['num', 'crown', 'judgments', 'normalizedInstant']);
const goal = await load('goal', ['integer', 'goalBaseline']);
const evidence = await load('evidence', ['numberValue', 'normalizedInstant']);
const overview = await load('overview', ['numberValue']);
const display = await load('display', ['parsePositiveInt']);
const values = [null, '', ' ', 0, 1, -1, 2.5, true, false, '12', '0x2', '1e3', 'bad', 1e20, [], [1], {}];
const timestamps = [null, '', 0, true, 'bad', '2026-10-10 23:59:59', '2026-10-11T00:00:00+08:00', '2026-10-10T16:00:00Z', '2026-10-11 00:00:00.123', ' 2026-10-11 00:00:00 '];
const records = [{}, { clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0 }, { clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0 }, { clear_cnt: 1, full_combo_cnt: 1, dondaful_combo_cnt: 0 }, { clear_cnt: 1, full_combo_cnt: 1, dondaful_combo_cnt: 1 }, { clear_cnt: null, full_combo_cnt: 0, dondaful_combo_cnt: 1 }, { good_cnt: 100, ok_cnt: 2, ng_cnt: 0 }, { good_cnt: 100, ok_cnt: null, ng_cnt: 0 }];
const readers = { 'viewer-daily-v1': daily.num, 'viewer-goal-v1': goal.integer, 'viewer-evidence-v1': evidence.numberValue, 'viewer-overview-v1': overview.numberValue, 'viewer-display-v1': display.parsePositiveInt };
const numeric = Object.entries(readers).flatMap(([profile, read]) => values.map(value => ({ profile, value, expected: read(value) })));
const instants = timestamps.map(value => ({ value, daily: daily.normalizedInstant(value) || null, goal: goal.goalBaseline({ highscore_datetime: value }, 'r', 't').highscoreDatetime, evidence: evidence.normalizedInstant(value) || null }));
const crowns = records.map(record => ({ record, crown: daily.crown(record), judgments: daily.judgments(record) }));
const result = { revision, timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [files[name], createHash('sha256').update(source).digest('hex')])), numeric, instants, crowns };
await writeFile(new URL(`../fixtures/viewer-read-${process.env.TZ === 'Asia/Shanghai' ? 'shanghai' : 'utc'}.json`, import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ timezone: result.timezone, numeric: numeric.length, instants: instants.length, crowns: crowns.length }));
