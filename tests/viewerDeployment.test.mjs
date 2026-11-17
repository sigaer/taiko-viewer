import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const helper = fileURLToPath(new URL('../scripts/release/prepare-viewer-ci.sh', import.meta.url));
const sshEntry = fileURLToPath(new URL('../scripts/release/viewer-ci-ssh-entry.sh', import.meta.url));
const env = {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'CI test', GIT_AUTHOR_EMAIL: 'ci@example.invalid',
  GIT_COMMITTER_NAME: 'CI test', GIT_COMMITTER_EMAIL: 'ci@example.invalid'};
const run = (cwd, command, args, extra = {}) => spawnSync(command, args, {
  cwd, env: {...env, ...extra}, encoding: 'utf8', timeout: 10000, maxBuffer: 65536
});
function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t) {
  const root = mkdtempSync(join(process.env.QA_RUN_TMPDIR || process.env.RUNNER_TEMP || '/var/tmp', 'viewer-ci-test-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const upstream = join(root, 'upstream'), remote = join(root, 'remote.git'), production = join(root, 'production');
  mkdirSync(upstream);
  git(upstream, 'init', '-b', 'main');
  writeFileSync(join(upstream, 'catalog.json'), '{"generation":1}\n');
  git(upstream, 'add', '.'); git(upstream, 'commit', '-m', 'initial');
  const initial = git(upstream, 'rev-parse', 'HEAD');
  git(root, 'clone', '--bare', upstream, remote);
  git(root, 'clone', remote, production);
  git(upstream, 'remote', 'add', 'origin', remote);
  function advance() {
    writeFileSync(join(upstream, 'app.txt'), Math.random().toString());
    git(upstream, 'add', '.'); git(upstream, 'commit', '-m', 'Merge pull request (no version prefix)');
    git(upstream, 'push', 'origin', 'main');
    return git(upstream, 'rev-parse', 'HEAD');
  }
  const prepare = sha => run(production, '/bin/bash', ['-euo', 'pipefail', '-c', 'source "$1"; prepare_viewer_ci "$2"', 'test', helper, sha]);
  const verify = sha => run(production, '/bin/bash', ['-euo', 'pipefail', '-c', 'source "$1"; verify_viewer_ci_revision "$2"', 'test', helper, sha]);
  return {production, upstream, initial, advance, prepare, verify};
}
test('validated current main fast-forwards and may be deployed again without creating commits', t => {
  const f = fixture(t), sha = f.advance();
  assert.equal(f.prepare(sha).status, 0);
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), sha);
  assert.equal(f.prepare(sha).status, 0);
  assert.equal(git(f.upstream, 'rev-parse', 'HEAD'), sha);
});
test('stale jobs and off-main revisions leave production HEAD unchanged', t => {
  const f = fixture(t), stale = f.advance(); f.advance();
  assert.notEqual(f.prepare(stale).status, 0);
  assert.notEqual(f.prepare('a'.repeat(40)).status, 0);
  assert.notEqual(f.prepare('main; touch untrusted').status, 0);
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), f.initial);
});
for (const staged of [false, true]) test(`dirty catalog is preserved and blocks deployment (staged=${staged})`, t => {
  const f = fixture(t), sha = f.advance(), path = join(f.production, 'catalog.json');
  writeFileSync(path, '{"generation":"unpublished"}\n');
  if (staged) git(f.production, 'add', '.');
  assert.notEqual(f.prepare(sha).status, 0);
  assert.equal(readFileSync(path, 'utf8'), '{"generation":"unpublished"}\n');
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), f.initial);
});
test('untracked private files survive fast-forward; colliding files block it', t => {
  const f = fixture(t), sha = f.advance();
  writeFileSync(join(f.production, '.env.local'), 'synthetic-private-value');
  writeFileSync(join(f.production, 'app.txt'), 'local work');
  assert.notEqual(f.prepare(sha).status, 0);
  assert.equal(readFileSync(join(f.production, 'app.txt'), 'utf8'), 'local work');
  rmSync(join(f.production, 'app.txt'));
  assert.equal(f.prepare(sha).status, 0);
  assert.equal(readFileSync(join(f.production, '.env.local'), 'utf8'), 'synthetic-private-value');
});
test('local divergent commits and detached/non-main branches cannot deploy', t => {
  const f = fixture(t), sha = f.advance();
  git(f.production, 'checkout', '-b', 'work');
  assert.notEqual(f.prepare(sha).status, 0);
  git(f.production, 'checkout', '--detach');
  assert.notEqual(f.prepare(sha).status, 0);
  git(f.production, 'checkout', 'main');
  writeFileSync(join(f.production, 'local.txt'), 'local');
  git(f.production, 'add', '.'); git(f.production, 'commit', '-m', 'local work');
  const local = git(f.production, 'rev-parse', 'HEAD');
  assert.notEqual(f.prepare(sha).status, 0);
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), local);
});
test('a push or catalog change during build prevents activation', t => {
  const f = fixture(t), sha = f.advance();
  assert.equal(f.prepare(sha).status, 0);
  writeFileSync(join(f.production, 'catalog.json'), '{}');
  assert.notEqual(f.verify(sha).status, 0);
  git(f.production, 'restore', 'catalog.json');
  f.advance();
  assert.notEqual(f.verify(sha).status, 0);
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), sha);
});
test('forced SSH entry rejects shells, short SHAs and extra commands before invoking deployment', () => {
  for (const value of ['', 'bash', 'deploy main', `deploy ${'a'.repeat(40)};id`, `deploy ${'a'.repeat(40)}\n`]) {
    const result = run('/var/tmp', '/bin/bash', [sshEntry], {SSH_ORIGINAL_COMMAND: value});
    assert.equal(result.status, 2);
  }
});
test('standard script accepts a tested merge commit, uses npm ci and never pushes from CI', t => {
  const f = fixture(t);
  mkdirSync(join(f.upstream, 'taiko_viewer'));
  mkdirSync(join(f.upstream, 'scripts/release'), {recursive: true});
  writeFileSync(join(f.upstream, 'taiko_viewer/package.json'), '{"version":"1.14.2"}');
  copyFileSync(fileURLToPath(new URL('../scripts/deploy_forum_web.sh', import.meta.url)), join(f.upstream, 'scripts/deploy_forum_web.sh'));
  copyFileSync(helper, join(f.upstream, 'scripts/release/prepare-viewer-ci.sh'));
  const sha = f.advance();
  git(f.production, 'pull', '--ff-only');
  const bin = join(f.production, '.test-bin'); mkdirSync(bin);
  const log = join(f.production, '.test-commands');
  writeFileSync(join(bin, 'git'), '#!/bin/bash\nprintf "git:%s\\n" "$*" >> "$COMMAND_LOG"\nexec /usr/bin/git "$@"\n');
  writeFileSync(join(bin, 'npm'), '#!/bin/bash\nprintf "npm:%s\\n" "$*" >> "$COMMAND_LOG"\nexit 90\n');
  for (const name of ['git', 'npm']) chmodSync(join(bin, name), 0o755);
  const result = run(f.production, '/bin/bash', ['scripts/deploy_forum_web.sh', '--ci', sha], {
    PATH: bin + ':' + process.env.PATH, COMMAND_LOG: log,
    DEPLOY_LOCK_FILE: join(f.production, '.test-deploy.lock'), BUILD_PID_FILE: join(f.production, '.test-build.pid')
  });
  // A controlled install failure stops before build, restart, or any service changes.
  assert.equal(result.status, 90, result.stderr);
  const commands = readFileSync(log, 'utf8');
  assert.match(commands, /^npm:ci$/m);
  assert.doesNotMatch(commands, /^git:push\b/m);
  assert.equal(git(f.production, 'rev-parse', 'HEAD'), sha);
});
