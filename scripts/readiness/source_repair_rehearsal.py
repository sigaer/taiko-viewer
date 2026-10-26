#!/usr/bin/env python3
"""Synthetic-only repair research. Not a production repair command.

Run with the installed Taiko interpreter through scripts/memory/run_qa.sh.
All filesystem mutations are confined to its owned QA scratch directory.
"""
import ast
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import time
from concurrent.futures import ThreadPoolExecutor

from taiko_store.publication import PublicationStore, PublicationError, _atomic_bytes, _json, _fsync_directory

signal.alarm(60)
scratch = Path(os.environ['QA_RUN_TMPDIR']).resolve()
assert '/qa-vault/runs/qa-' in str(scratch) and scratch.name == 'scratch'
assert '/development.slice/development-qa.slice/' in Path('/proc/self/cgroup').read_text()
out = Path('/home/sigaer/taiko/qa-vault/evidence/viewer-source-stability-20261026')
work = scratch / 'source-repair-synthetic'
work.mkdir()
socket.socket.connect = lambda *_: (_ for _ in ()).throw(AssertionError('NETWORK_FORBIDDEN'))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def raw_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


class RepairStore(PublicationStore):
    """Prototype: an approved *synthetic* forward-only repair intent.

    Standard recovery cannot reinstall an already corrupt parent. Only this
    isolated coordinator may resume its exact, prevalidated repair receipt.
    It does not change the installed kernel or its normal recovery policy.
    """
    def __init__(self, root, identity, plan, **kwargs):
        assert Path(root).resolve().is_relative_to(work)
        self.plan = plan
        super().__init__(root, identity, **kwargs)

    def _validate_repair(self, current, following):
        p = self.plan
        if current != p['parent'] and current != following:
            raise PublicationError('Unapproved repair parent')
        expected = {**p['parent']['files'], 'current': p['candidate']}
        if (following['identity'] != self.identity or following['sequence'] != p['parent']['sequence'] + 1
                or following.get('previousCommitId') != p['parent']['commitId']
                or following['commitId'] != p['transactionId']
                or following.get('dependencyHash') != p['approvalDigest']
                or following['files'] != expected):
            raise PublicationError('Repair receipt is outside approved scope')
        for reference in following['files'].values():
            self.read_object(reference)
        if sha((self.objects / p['parent']['files']['current']['sha256']).read_bytes()) != p['badSha256']:
            raise PublicationError('Forensic parent changed')

    def _recover(self):
        pending_path = self.base / 'pending.json'
        if not pending_path.exists():
            return
        pending = self._read_json(pending_path)
        p = self.plan
        expected = {'schema': 1, 'identity': self.identity,
                    'previousCommitId': p['parent']['commitId'],
                    'nextCommitId': p['transactionId'], 'changedKeys': ['current']}
        if pending != expected:
            raise PublicationError('Unapproved pending repair')
        following = self._read_json(self.commits / (p['transactionId'] + '.json'))
        self._validate_manifest(following)
        self._validate_repair(self.view(), following)
        self._install('current', p['candidate'])
        self.fault('repair-projection-installed')
        _atomic_bytes(self.base / 'committed.json', _json(following))
        self.fault('repair-commit-durable')
        pending_path.unlink()
        _fsync_directory(self.base)
        self.fault('repair-pending-cleared')


identity = '990000000000000001'
results = []


def setup(name):
    root = work / name
    store = PublicationStore(root, identity)
    with store.exclusive():
        store.commit({'current': b'{"synthetic":1}',
                      'history/data_fixture.json': b'{"syntheticHistory":1}'})
        parent = store.commit({'current': b'{"synthetic":2}'})
    old_records = {p.name: sha(p.read_bytes()) for p in store.commits.glob('*.json')}
    path = root / (identity + 'data.json')
    object_path = store.objects / parent['files']['current']['sha256']
    assert path.stat().st_ino == object_path.stat().st_ino
    path.write_bytes(b'{"synthetic":2,"damaged":true}')
    payload = raw_json({'synthetic': 3, 'observation': 'new-authoritative-repair; not old bytes'})
    plan = {'parent': parent, 'badSha256': sha(path.read_bytes()),
            'candidate': {'bytes': len(payload), 'sha256': sha(payload)},
            'transactionId': sha(name.encode())[:32], 'approvalDigest': sha(b'synthetic-approved-exact-repair')}
    # Represents protected SQL/credential/measurement authorities; not a SQL test.
    protected = root / 'protected-authorities.synthetic.json'
    protected.write_bytes(b'{"session":"revoked","key":"revoked","grant":"revoked","goal":7,"growth":11}')
    return root, parent, payload, plan, old_records, sha(protected.read_bytes())


def run(root, plan, payload, fault=None):
    store = RepairStore(root, identity, plan, fault=fault)
    with store.exclusive():
        if store.view()['commitId'] == plan['transactionId']:
            store._validate_repair(store.view(), store.view())
            return store.view()
        if store.view() != plan['parent']:
            raise PublicationError('Stale repair plan')
        reference = store.stage(payload)
        if reference != plan['candidate']:
            raise PublicationError('Candidate bytes changed')
        return store.publish({'current': reference}, transaction_id=plan['transactionId'],
                             dependency_hash=plan['approvalDigest'])


def verify(root, plan, payload, records, protected_hash):
    store = PublicationStore(root, identity)
    with store.shared():
        view = store.view()
        assert view['sequence'] == plan['parent']['sequence'] + 1
        assert view['previousCommitId'] == plan['parent']['commitId']
        assert store.reader().current_raw() == payload
        assert {k: v for k, v in view['files'].items() if k != 'current'} == {
            k: v for k, v in plan['parent']['files'].items() if k != 'current'}
        assert (root / (identity + 'data.json')).stat().st_ino == (
            store.objects / plan['candidate']['sha256']).stat().st_ino
        for name, digest in records.items():
            assert sha((store.commits / name).read_bytes()) == digest
        assert sha((root / 'protected-authorities.synthetic.json').read_bytes()) == protected_hash
        assert sha((store.objects / plan['parent']['files']['current']['sha256']).read_bytes()) == plan['badSha256']
        assert not (store.base / 'pending.json').exists()


try:
    # Actual installed normal saver refuses corrupt current before SQL locks.
    from taiko_bot.runtime.player.center import userdata_storage
    root, parent, payload, plan, records, protected = setup('normal-saver')
    store = PublicationStore(root, identity)
    userdata_storage._load_locked_song_keys = lambda *_: (_ for _ in ()).throw(AssertionError('SQL_FORBIDDEN'))
    with store.exclusive():
        try:
            userdata_storage._save_userdata_locked(store, identity, {'songs': []}, source='wahlap')
        except PublicationError:
            results.append({'case': 'normalSaverRejectsBadCurrentBeforeSql', 'pass': True})
        else:
            raise AssertionError('NORMAL_SAVER_UNEXPECTEDLY_ACCEPTED_CORRUPTION')

    # Installed kernel primitive can publish a new current, but generic rollback
    # before commit cannot reinstall the damaged parent and leaves intent closed.
    root, parent, payload, plan, records, protected = setup('unmodified-recovery')
    def throw_at_projection(point):
        if point == 'projection-0':
            raise RuntimeError('synthetic interruption')
    store = PublicationStore(root, identity, fault=throw_at_projection)
    with store.exclusive():
        try:
            store.commit({'current': payload}, transaction_id=plan['transactionId'])
        except PublicationError:
            assert store.view() == parent and (store.base / 'pending.json').exists()
            results.append({'case': 'unmodifiedRollbackRejectsCorruptParent', 'pass': True,
                            'pendingRetained': True, 'failClosed': True})
        else:
            raise AssertionError('GENERIC_ROLLBACK_DID_NOT_EXPOSE_EXPECTED_BOUNDARY')

    for fault_point in [None, 'objects-staged', 'intent-durable', 'projection-0',
                        'projections-durable', 'commit-durable', 'repair-projection-installed',
                        'repair-commit-durable', 'repair-pending-cleared']:
        name = fault_point or 'success'
        root, parent, payload, plan, records, protected = setup(name)
        if fault_point:
            pid = os.fork()
            if pid == 0:
                try:
                    run(root, plan, payload, lambda p: os._exit(97) if p == fault_point else None)
                    os._exit(98)
                except BaseException:
                    os._exit(99)
            _, status = os.waitpid(pid, 0)
            assert os.waitstatus_to_exitcode(status) == 97
            # Durable view can only be the approved parent or the new receipt.
            current = json.loads((root / '.taiko-publications' / identity / 'committed.json').read_text())
            assert current['commitId'] in [parent['commitId'], plan['transactionId']]
        view = run(root, plan, payload)
        verify(root, plan, payload, records, protected)
        assert run(root, plan, payload) == view
        results.append({'case': name, 'pass': True, 'actualProcessDeath': bool(fault_point),
                        'oldCommitRecordsPreserved': True, 'newRevisionOnly': True,
                        'protectedAuthoritiesUnchanged': True, 'idempotent': True})

    # A foreign pending transaction must never be adopted by repair recovery.
    root, parent, payload, plan, records, protected = setup('foreign-pending')
    store = PublicationStore(root, identity)
    (store.base / 'pending.json').write_bytes(raw_json({'schema': 1, 'identity': identity,
        'previousCommitId': parent['commitId'], 'nextCommitId': 'a' * 32, 'changedKeys': ['current']}))
    before = sha((store.base / 'committed.json').read_bytes())
    try:
        run(root, plan, payload)
    except PublicationError:
        assert sha((store.base / 'committed.json').read_bytes()) == before
        results.append({'case': 'foreignPendingDeniedWithoutManifestChange', 'pass': True})
    else:
        raise AssertionError('FOREIGN_PENDING_ACCEPTED')

    root, parent, payload, plan, records, protected = setup('changed-candidate')
    try:
        run(root, plan, payload + b' ')
    except PublicationError:
        assert json.loads((root / '.taiko-publications' / identity / 'committed.json').read_text()) == parent
        results.append({'case': 'differentCandidateDenied', 'pass': True})
    else:
        raise AssertionError('UNAPPROVED_CONTENT_ACCEPTED')

    root, parent, payload, plan, records, protected = setup('changed-parent')
    store = PublicationStore(root, identity)
    with store.exclusive():
        store.commit({'current': b'{"synthetic":"newer-concurrent-observation"}'})
    before = sha((store.base / 'committed.json').read_bytes())
    try:
        run(root, plan, payload)
    except PublicationError:
        assert sha((store.base / 'committed.json').read_bytes()) == before
        results.append({'case': 'changedParentDenied', 'pass': True})
    else:
        raise AssertionError('STALE_PARENT_ACCEPTED')

    root, parent, payload, plan, records, protected = setup('candidate-damaged-after-intent')
    pid = os.fork()
    if pid == 0:
        run(root, plan, payload, lambda p: os._exit(97) if p == 'intent-durable' else None)
        os._exit(98)
    _, status = os.waitpid(pid, 0)
    assert os.waitstatus_to_exitcode(status) == 97
    candidate = root / '.taiko-publications' / identity / 'objects' / plan['candidate']['sha256']
    candidate.write_bytes(b'synthetic disk corruption')
    before = sha((root / '.taiko-publications' / identity / 'committed.json').read_bytes())
    try:
        run(root, plan, payload)
    except PublicationError:
        assert sha((root / '.taiko-publications' / identity / 'committed.json').read_bytes()) == before
        results.append({'case': 'candidateDamageDuringRecoveryFailsClosed', 'pass': True})
    else:
        raise AssertionError('DAMAGED_CANDIDATE_ACCEPTED')

    root, parent, payload, plan, records, protected = setup('kernel-lock-conflict')
    store = PublicationStore(root, identity)
    with store.exclusive():
        pid = os.fork()
        if pid == 0:
            try:
                with RepairStore(root, identity, plan, lock_timeout=.05).exclusive():
                    os._exit(98)
            except PublicationError:
                os._exit(97)
        _, status = os.waitpid(pid, 0)
        assert os.waitstatus_to_exitcode(status) == 97
        assert store.view() == parent
    results.append({'case': 'kernelLockConflictDenied', 'pass': True})

    # Inspect the installed upstream function with fake HTTP/config/save only.
    source = Path('/opt/taiko-bot/current/lib/python3.11/site-packages/taiko_bot/runtime/player/center/update_user.py')
    tree = ast.parse(source.read_text());module = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)], type_ignores=[])
    calls = []; saves = []
    class Response:
        status_code = 200
        def __init__(self, value): self.value = value
        def json(self): return self.value
    class Requests:
        def post(self, url, **kwargs):
            calls.append(('POST', url.split('/api/')[1], kwargs.get('timeout')))
            return Response({'message': 'ok', 'data': {'playedRecords': {'scoreInfo': []}}} if 'songs' in url else {'data': {'players': [{'userid': identity}]}})
        def get(self, url, **kwargs):
            calls.append(('GET', url.split('/api/')[1].replace(identity, ':case'), kwargs.get('timeout')))
            return Response({'data': {}})
    namespace = {'os': os, '_runtime_root': lambda: scratch, 'open': lambda *_: io.StringIO('{"cookie":"synthetic"}'),
                 'json': json, 'requests': Requests(), 'ThreadPoolExecutor': ThreadPoolExecutor,
                 'PublicationError': PublicationError, 'normalize_wahlap_dojo_scores': lambda _: {'scores': [], 'version': '2026'},
                 'save_userdata': lambda *a, **k: saves.append(True)}
    exec(compile(module, str(source), 'exec'), namespace)
    assert namespace['getUserData'](identity, publication_store=object()) == 0
    assert len(calls) == 4 and len(saves) == 1
    results.append({'case': 'installedUpstreamFunctionHasFourRequestsAndPersistence', 'pass': True,
                    'syntheticHttpCalls': list(calls), 'persistenceAttemptCount': len(saves)})

    namespace['_select_search_player'] = lambda *_: {'userid': '990000000000000002'}
    saves.clear()
    try:
        namespace['getUserData'](identity, publication_store=object())
    except PublicationError:
        assert not saves
        results.append({'case': 'leasedUpstreamFunctionRejectsWrongProfile', 'pass': True})
    else:
        raise AssertionError('MISMATCHED_PROFILE_ACCEPTED')

    summary = {'status': 'PASS_SYNTHETIC_ONLY', 'tests': len(results), 'cases': results,
               'networkConnections': 0, 'sqlConnections': 0, 'productionRootTouched': False,
               'installedKernelModified': False, 'historicalMutationActorProven': False,
               'oldBrokenRevisionBecomesRecoverable': False,
               'productionRepairReady': False,
               'remaining': ['authorized authoritative candidate', 'reviewed production coordinator and binding recheck',
                             'exact scoped production write approval'],
               'kernelSha256': sha(Path('/opt/taiko-bot/current/lib/python3.11/site-packages/taiko_store/publication.py').read_bytes())}
    (out / 'source-repair-rehearsal.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary))
finally:
    shutil.rmtree(work)
