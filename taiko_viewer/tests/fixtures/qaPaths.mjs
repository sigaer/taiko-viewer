// QA-owned paths only. The bounded runner creates and cleans this run's scratch.
import assert from 'node:assert/strict';
import {realpathSync, lstatSync, readFileSync} from 'node:fs';
import {resolve, isAbsolute, sep} from 'node:path';
function owned(name, leaf) {
 const value=process.env[name], run=process.env.QA_RUN_DIR;
 assert.ok(value && run && isAbsolute(value) && isAbsolute(run), 'Bounded QA run paths required');
 assert.ok(!lstatSync(value).isSymbolicLink() && !lstatSync(run).isSymbolicLink(), 'QA root symlink forbidden');
 assert.equal(realpathSync(value),resolve(realpathSync(run),leaf),'QA path must belong to this run');
 return realpathSync(value);
}
export function qaTempPrefix(prefix) {
 assert.match(prefix,/^[a-zA-Z0-9_-]+$/);
 return resolve(owned('QA_RUN_TMPDIR','scratch'),prefix);
}
export function assertQaEvidencePath(path) {
 const base=owned('QA_EVIDENCE_DIR','evidence');
 assert.ok(isAbsolute(path) && resolve(path).startsWith(base+sep),'Output must belong to this run evidence');
 return path;
}
export function assertQaPython() {
 const manifest=JSON.parse(readFileSync(process.env.QA_ARTIFACT_MANIFEST,'utf8'));
 const python=process.env.TAIKO_PYTHON_EXECUTABLE;
 assert.ok(isAbsolute(python),'Explicit installed interpreter required');
 assert.ok([manifest.candidate?.python,...Object.values(manifest.roles||{}).map(x=>x.python)].includes(python),'Interpreter must match protected artifact manifest');
 return python;
}
