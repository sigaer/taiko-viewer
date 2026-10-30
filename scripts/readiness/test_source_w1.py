"""New W1 execution paths only; synthetic identities and owned QA scratch."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import source_w1_coordinator as boundary
from source_w1_repair import RepairStore, fingerprint, repair
from taiko_store.publication import PublicationError, PublicationStore

socket.socket.connect = lambda *_: (_ for _ in ()).throw(AssertionError('NETWORK_FORBIDDEN'))
SCRATCH = Path(os.environ['QA_RUN_TMPDIR']).resolve()
assert '/qa-vault/runs/qa-' in str(SCRATCH) and SCRATCH.name == 'scratch'
IDENTITY = '990000000000000001'


def consent(_):
    pass


def fixture(name):
    root = SCRATCH / name
    store = PublicationStore(root, IDENTITY)
    with store.exclusive():
        store.commit({'current': b'{"synthetic":1}', 'history/data_fixture.json': b'{"facts":7}'})
        parent = store.commit({'current': b'{"synthetic":2}'})
    projection = root / (IDENTITY + 'data.json')
    projection.write_bytes(b'{"synthetic":2,"damaged":true}')
    candidate = root / 'candidate.private'
    candidate.write_bytes(b'{"synthetic":3}')
    plan = {'root': str(root), 'identity': IDENTITY, 'parent': parent,
            'badActual': fingerprint(projection), 'candidate': fingerprint(candidate),
            'candidatePath': str(candidate), 'transactionId': hashlib.sha256(name.encode()).hexdigest()[:32],
            'approvalDigest': hashlib.sha256(b'synthetic approved material').hexdigest()}
    (root / 'protected.private').write_bytes(b'{"credentials":"revoked","authorization":"revoked","growth":11,"goal":13}')
    return plan


def records(plan):
    base = Path(plan['root']) / '.taiko-publications' / IDENTITY
    return {p.name: fingerprint(p) for p in (base / 'commits').glob('*.json')}


class RepairTests(unittest.TestCase):
    def setUp(self):
        self.plan = fixture(self.id().split('.')[-1])
        self.root = Path(self.plan['root'])
        self.records = records(self.plan)
        self.protected = fingerprint(self.root / 'protected.private')

    def tearDown(self):
        shutil.rmtree(self.root)

    def verify(self):
        store = PublicationStore(self.root, IDENTITY)
        with store.shared():
            view = store.view()
            self.assertEqual(view['sequence'], self.plan['parent']['sequence'] + 1)
            self.assertEqual(view['previousCommitId'], self.plan['parent']['commitId'])
            self.assertEqual(fingerprint(self.root / (IDENTITY + 'data.json')), self.plan['candidate'])
            self.assertEqual(hashlib.sha256(store.reader().current_raw()).hexdigest(), self.plan['candidate']['sha256'])
            self.assertEqual({k: v for k, v in view['files'].items() if k != 'current'},
                             {k: v for k, v in self.plan['parent']['files'].items() if k != 'current'})
            self.assertEqual(fingerprint(store.objects / self.plan['parent']['files']['current']['sha256']), self.plan['badActual'])
            for name, expected in self.records.items():
                self.assertEqual(fingerprint(store.commits / name), expected)
            self.assertFalse((store.base / 'pending.json').exists())
        self.assertEqual(fingerprint(self.root / 'protected.private'), self.protected)

    def die(self, point):
        plan_path = self.root / 'plan.private'
        plan_path.write_text(json.dumps(self.plan))
        result = subprocess.run([sys.executable, '-I', '-B', __file__, 'child', str(plan_path), point],
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 77)

    def test_normal_commit_and_idempotent_confirmation(self):
        scope={'evidenceDirectory':str(self.root/'private-evidence'),'parent':self.plan['parent']}
        self.assertEqual(repair(self.plan, consent,before_stage=lambda store:boundary.preserve_before(store,scope))[1], 'COMMITTED')
        self.assertEqual(fingerprint(self.root/'private-evidence/bad-current.original'),self.plan['badActual'])
        self.assertEqual(json.loads((self.root/'private-evidence/parent-manifest.json').read_text()),self.plan['parent'])
        count = len(records(self.plan))
        self.assertEqual(repair(self.plan, consent)[1], 'ALREADY_COMMITTED')
        self.assertEqual(len(records(self.plan)), count)
        self.verify()

    def test_forensic_copy_failure_stops_before_staging(self):
        def failed_copy(_):raise RuntimeError('SYNTHETIC_COPY_FAILURE')
        with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_COPY_FAILURE'):
            repair(self.plan,consent,before_stage=failed_copy)
        self.assertEqual(records(self.plan),self.records)
        base=self.root/'.taiko-publications'/IDENTITY
        self.assertFalse((base/'pending.json').exists())
        self.assertEqual(json.loads((base/'committed.json').read_text()),self.plan['parent'])

    def test_before_intent_exception_leaves_damaged_parent_unavailable(self):
        def fault(point):
            if point == 'objects-staged':
                raise RuntimeError('SYNTHETIC_BEFORE_INTENT')
        with self.assertRaisesRegex(RuntimeError, 'SYNTHETIC_BEFORE_INTENT'):
            repair(self.plan, consent, fault=fault)
        store = PublicationStore(self.root, IDENTITY)
        with store.shared():
            self.assertEqual(store.view(), self.plan['parent'])
            with self.assertRaises(PublicationError):
                store.reader().current_raw()
        repair(self.plan, consent)
        self.verify()

    def test_intent_death_recovers_only_exact_new_revision(self):
        self.die('intent-durable')
        store = PublicationStore(self.root, IDENTITY)
        self.assertTrue((store.base / 'pending.json').exists())
        # Read metadata directly: normal shared() would attempt generic recovery.
        self.assertEqual(json.loads((store.base / 'committed.json').read_text()), self.plan['parent'])
        repair(self.plan, consent)
        self.verify()

    def test_commit_death_is_confirmed_without_second_revision(self):
        self.die('commit-durable')
        self.assertEqual(repair(self.plan, consent)[1], 'ALREADY_COMMITTED')
        self.verify()

    def test_exception_after_install_recovers_forward_never_corrupt_parent(self):
        def fault(point):
            if point == 'projection-0':
                raise RuntimeError('SYNTHETIC_AFTER_INSTALL')
        with self.assertRaisesRegex(RuntimeError, 'SYNTHETIC_AFTER_INSTALL'):
            repair(self.plan, consent, fault=fault)
        self.verify()

    def test_recovery_death_can_confirm_same_receipt(self):
        self.die('intent-durable')
        self.die('repair-commit-durable')
        repair(self.plan, consent)
        self.verify()

    def test_parent_candidate_and_binding_changes_reject_without_publish(self):
        changed = copy.deepcopy(self.plan)
        changed['parent']['sequence'] += 1
        with self.assertRaises(PublicationError): repair(changed, consent)
        candidate = Path(self.plan['candidatePath'])
        original = candidate.read_bytes();candidate.write_bytes(b'changed')
        with self.assertRaisesRegex(PublicationError, 'CANDIDATE_CHANGED'):repair(self.plan, consent)
        candidate.write_bytes(original)
        def denied(_):raise boundary.W1Denied('W1_BINDING_CHANGED')
        with self.assertRaisesRegex(boundary.W1Denied, 'BINDING_CHANGED'):repair(self.plan, denied)
        self.assertEqual(records(self.plan), self.records)

    def test_changed_approval_or_foreign_pending_cannot_resume(self):
        self.die('intent-durable')
        changed = copy.deepcopy(self.plan);changed['approvalDigest'] = 'f' * 64
        with self.assertRaisesRegex(PublicationError, 'RECEIPT_OUTSIDE_SCOPE'):repair(changed, consent)
        store = PublicationStore(self.root, IDENTITY)
        pending = json.loads((store.base / 'pending.json').read_text());pending['changedKeys'].append('history/data_fixture.json')
        (store.base / 'pending.json').write_text(json.dumps(pending))
        with self.assertRaisesRegex(PublicationError, 'FOREIGN_PENDING'):repair(self.plan, consent)
        self.assertEqual(json.loads((store.base / 'committed.json').read_text()), self.plan['parent'])

    def test_binding_check_occurs_under_source_ex_and_before_mutation(self):
        points = []
        def authority(point):
            points.append(point)
            if point == 'locked':
                # Source lock is already owned: competing kernel lease cannot enter.
                other = PublicationStore(self.root, IDENTITY, lock_timeout=0)
                with self.assertRaisesRegex(PublicationError, 'lock deadline'):
                    with other.exclusive():pass
        repair(self.plan, authority)
        self.assertEqual(points[0], 'preflight')
        self.assertIn('locked', points)
        self.verify()


class BoundaryTests(unittest.TestCase):
    def test_default_command_never_opens_private_material_or_database(self):
        with patch.object(sys, 'argv', ['w1']), patch.object(boundary, 'private_bytes', side_effect=AssertionError('PRIVATE_READ')):
            self.assertEqual(boundary.main(), 3)

    def test_execute_without_consent_refuses_before_admission_or_database(self):
        scope=json.dumps({'case':'B1-CURRENT-01','candidate':boundary.CANDIDATE}).encode()
        digest=hashlib.sha256(scope).hexdigest()
        materials=json.dumps({'scopeSha256':digest,'codeBundleSha256':boundary.bundle_hash()}).encode()
        auth=json.dumps({'authorizationStatus':'NOT_GRANTED'}).encode()
        with patch.object(boundary,'SCOPE_SHA256',digest),patch.object(boundary,'private_bytes',side_effect=[scope,materials,auth]),patch.object(boundary,'admission',side_effect=AssertionError('ADMISSION_OR_DB_REACHED')):
            with self.assertRaises(boundary.W1Denied):boundary.execute('scope','materials','authorization')

    def test_exact_scope_materials_code_window_and_explicit_consent(self):
        scope = {'case': 'B1-CURRENT-01', 'candidate': boundary.CANDIDATE}
        raw = json.dumps(scope).encode();sha = hashlib.sha256(raw).hexdigest()
        materials = json.dumps({'scopeSha256':sha,'codeBundleSha256':boundary.bundle_hash()}).encode()
        stamp = dt.datetime.now(dt.timezone.utc)
        auth = {'scopeSha256':sha,'materialsSha256':hashlib.sha256(materials).hexdigest(),
                'authorizationStatus':'EXPLICIT_USER_W1_ONLY','authorizationReference':'synthetic explicit consent',
                'windowStartUtc':(stamp-dt.timedelta(seconds=1)).isoformat(),
                'windowEndUtc':(stamp+dt.timedelta(seconds=60)).isoformat()}
        with patch.object(boundary,'SCOPE_SHA256',sha):
            boundary.check_approval(raw,materials,json.dumps(auth).encode(),now=stamp)
            for altered in [b'{}',materials+b' ']:
                with self.assertRaises(boundary.W1Denied):boundary.check_approval(raw,altered,json.dumps(auth).encode(),now=stamp)
            for field,value in [('authorizationStatus','NOT_GRANTED'),('scopeSha256','0'*64),('windowEndUtc',stamp.isoformat())]:
                changed={**auth,field:value}
                with self.assertRaises(boundary.W1Denied):boundary.check_approval(raw,materials,json.dumps(changed).encode(),now=stamp)
            with self.assertRaises(boundary.W1Denied):boundary.check_approval(raw+b' ',materials,json.dumps(auth).encode(),now=stamp)

    def test_sql_locking_read_and_rollback_only(self):
        class Cursor:
            def __enter__(self):return self
            def __exit__(self,*_):pass
            def execute(self,query,params=None):
                queries.append(query);self.query=query
            def fetchone(self):return {'selected_database':'synthetic_test'}
            def fetchall(self):
                if 'information_schema' in self.query:
                    return [{'TABLE_NAME':name,'ENGINE':'InnoDB'} for name in ['web_taiko_bindings','web_song_locks']]
                return [] if 'song_locks' in self.query else [{'id':1}]
        class Connection:
            def cursor(self):return Cursor()
            def rollback(self):events.append('rollback')
            def close(self):events.append('close')
        queries=[];events=[]
        scope={'identity':IDENTITY,'database':'synthetic_test','bindings':[{'id':1}]}
        with boundary.BindingLease(scope,connect=Connection) as lease:
            lease.check();lease.check()
            scope['bindings']=[{'id':2}]
            with self.assertRaisesRegex(boundary.W1Denied,'BINDING_CHANGED'):lease.check()
        self.assertEqual(events,['rollback','close'])
        self.assertTrue(all(q.startswith(('SELECT','SET SESSION','START TRANSACTION')) for q in queries))
        self.assertTrue(all('FOR UPDATE' in q for q in queries if 'FROM web_' in q))


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'child':
        plan = json.loads(Path(sys.argv[2]).read_text());point = sys.argv[3]
        repair(plan, consent, fault=lambda actual: os._exit(77) if actual == point else None)
        sys.exit(78)
    unittest.main()
