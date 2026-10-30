#!/usr/bin/env python3
"""B1-CURRENT-01 only. Default mode refuses before opening private material."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shlex
import signal
import stat
import sys

SCOPE_SHA256 = '1ea0c2ae5374ef874dc1cbfa33c96670a5224b39f3ea645c6bc98262a52fddca'
CANDIDATE = {'bytes': 430712, 'sha256': 'a3cbdfc7aff5ae7874a0dad5f33ef87dec0d47fc238d7a1eee214a88c4cf3b18'}
CODE_FILES = ('source_w1_coordinator.py', 'source_w1_repair.py')


class W1Denied(RuntimeError):
    pass


def private_bytes(path, limit=1024**2):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_size > limit:
            raise W1Denied('W1_PRIVATE_MATERIAL_INVALID')
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise W1Denied('W1_PRIVATE_MATERIAL_INVALID')
    return raw


def bundle_hash():
    rows = [{'name': name, 'sha256': hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()}
            for name in CODE_FILES]
    return hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def check_approval(scope_raw, materials_raw, authorization_raw, *, now=None):
    """Pure boundary; no Source, DB or evidence access on rejection."""
    if hashlib.sha256(scope_raw).hexdigest() != SCOPE_SHA256:
        raise W1Denied('W1_SCOPE_CHANGED')
    scope, materials, auth = map(json.loads, (scope_raw, materials_raw, authorization_raw))
    if (scope['case'] != 'B1-CURRENT-01' or scope['candidate'] != CANDIDATE
            or materials.get('scopeSha256') != SCOPE_SHA256
            or materials.get('codeBundleSha256') != bundle_hash()
            or auth.get('authorizationStatus') != 'EXPLICIT_USER_W1_ONLY'
            or not auth.get('authorizationReference')
            or auth.get('materialsSha256') != hashlib.sha256(materials_raw).hexdigest()
            or auth.get('scopeSha256') != SCOPE_SHA256):
        raise W1Denied('W1_APPROVAL_CHANGED_OR_NOT_GRANTED')
    current = now or dt.datetime.now(dt.timezone.utc)
    start = dt.datetime.fromisoformat(auth['windowStartUtc'])
    end = dt.datetime.fromisoformat(auth['windowEndUtc'])
    if (start.tzinfo is None or end.tzinfo is None or not start <= current < end
            or not 0 < (end - start).total_seconds() <= 300):
        raise W1Denied('W1_OUTSIDE_APPROVED_WINDOW')
    return scope, hashlib.sha256(materials_raw).hexdigest()


def admission():
    membership = Path('/proc/self/cgroup').read_text()
    if '/development.slice/development-qa.slice/' not in membership:
        raise W1Denied('W1_QA_ISOLATION_REQUIRED')
    group = Path('/sys/fs/cgroup') / membership.strip().split('::')[-1].lstrip('/')
    if (int((group / 'memory.high').read_text()) != 2 * 1024**3
            or int((group / 'memory.max').read_text()) != 3 * 1024**3
            or (group / 'cpu.max').read_text().split() != ['200000', '100000']):
        raise W1Denied('W1_QA_LIMITS_CHANGED')
    memory = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
    pressure = float(re.search(r'full avg10=([\d.]+)', Path('/proc/pressure/memory').read_text())[1])
    if memory['MemAvailable'] < math.ceil(.30 * memory['MemTotal'] + 3 * 1024**2) or pressure >= 2:
        raise W1Denied('W1_RESOURCE_ADMISSION_DENIED')


class BindingLease:
    """Source EX precedes SQL row locks; SQL transaction always rolls back.

    Locking reads protect captured ownership and song-lock state until the
    filesystem transaction completes. There is no SQL DML or schema change.
    """
    def __init__(self, scope, connect=None):
        self.scope, self.connection, self.connect = scope, None, connect

    def __enter__(self):
        return self

    def check(self):
        if self.connection is None:
            if self.connect is None:
                import pymysql
                env = {}
                for line in Path(self.scope['dbEnvironmentFile']).read_text().splitlines():
                    key, sep, value = line.partition('=')
                    if sep and key.strip().startswith(('NUXT_DB_', 'TAIKO_DB_')):
                        parts = shlex.split(value)
                        env[key.strip()] = parts[0] if len(parts) == 1 else value.strip()
                def setting(key, default=None):
                    return env.get('NUXT_DB_' + key) or env.get('TAIKO_DB_' + key) or default
                self.connection = pymysql.connect(host=setting('HOST', '127.0.0.1'), port=int(setting('PORT', 3306)),
                    user=setting('USER'), password=setting('PASSWORD'), database=setting('NAME'),
                    autocommit=False, connect_timeout=3, read_timeout=3, cursorclass=pymysql.cursors.DictCursor)
            else:
                self.connection = self.connect()
            with self.connection.cursor() as cursor:
                cursor.execute('SET SESSION MAX_EXECUTION_TIME=2000')
                cursor.execute('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
                cursor.execute('START TRANSACTION')
                cursor.execute("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES "
                               "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('web_taiko_bindings','web_song_locks')")
                engines = {row['TABLE_NAME']: row['ENGINE'] for row in cursor.fetchall()}
                if engines != {'web_taiko_bindings': 'InnoDB', 'web_song_locks': 'InnoDB'}:
                    raise W1Denied('W1_TRANSACTIONAL_ROW_LOCKS_REQUIRED')
        with self.connection.cursor() as cursor:
            cursor.execute('SELECT DATABASE() selected_database')
            if cursor.fetchone()['selected_database'] != self.scope['database']:
                raise W1Denied('W1_DATABASE_CHANGED')
            cursor.execute('SELECT id,user_id,taiko_id,source,is_current,created_at,updated_at '
                           'FROM web_taiko_bindings WHERE taiko_id=%s LIMIT 3 FOR UPDATE', [self.scope['identity']])
            rows = json.loads(json.dumps(cursor.fetchall(), default=str))
            if rows != self.scope['bindings']:
                raise W1Denied('W1_BINDING_CHANGED')
            cursor.execute('SELECT song_no,level,is_locked FROM web_song_locks WHERE taiko_id=%s FOR UPDATE',
                           [self.scope['identity']])
            if any(row['is_locked'] for row in cursor.fetchall()):
                raise W1Denied('W1_SONG_LOCK_CHANGED')

    def __exit__(self, *_):
        if self.connection is not None:
            try:
                self.connection.rollback()
            finally:
                self.connection.close()


def execute(scope_path, materials_path, authorization_path):
    scope_raw, materials_raw, auth_raw = [private_bytes(p) for p in (scope_path, materials_path, authorization_path)]
    scope, approval_digest = check_approval(scope_raw, materials_raw, auth_raw)
    if os.getuid() != scope['executionUid']:
        raise W1Denied('W1_EXECUTION_IDENTITY_CHANGED')
    admission()
    def deadline(*_):
        raise W1Denied('W1_WALL_DEADLINE')
    signal.signal(signal.SIGALRM, deadline)
    signal.signal(signal.SIGTERM, deadline)
    signal.setitimer(signal.ITIMER_REAL, 60)
    from source_w1_repair import repair, fingerprint
    import taiko_store.publication as kernel
    if fingerprint(Path(kernel.__file__))['sha256'] != scope['kernelSha256']:
        raise W1Denied('W1_KERNEL_CHANGED')
    base = Path(scope['root']) / '.taiko-publications' / scope['identity']
    directories = (Path(scope['root']), base, base / 'objects', base / 'commits')
    if (any(not p.is_dir() or p.is_symlink() for p in directories)
            or not (base / 'committed.json').is_file() or not (base / 'lock').is_file()):
        raise W1Denied('W1_EXISTING_SOURCE_REQUIRED')
    # BindingLease acquires SQL locks on its first check. That check must occur
    # under Source EX, including recovery; the pre-construction check is pure.
    with BindingLease(scope) as binding:
        def consent():
            if [private_bytes(p) for p in (scope_path, materials_path, authorization_path)] != [scope_raw, materials_raw, auth_raw]:
                raise W1Denied('W1_APPROVAL_CHANGED')
            check_approval(scope_raw, materials_raw, auth_raw)
        plan = {**scope, 'approvalDigest': approval_digest}
        # Acquire binding row locks only after Source EX, including recovery.
        def authorized(point):
            consent()
            if point == 'locked':
                binding.check()
        receipt, state = repair(plan, authorized, before_stage=lambda store: preserve_before(store, scope))
    signal.setitimer(signal.ITIMER_REAL, 0)
    return {'case': 'B1-CURRENT-01', 'state': state, 'sequence': receipt['sequence'],
            'candidate': CANDIDATE, 'requiresSeparateRecoveryValidation': True, 'verifiedAdvanced': False}


def preserve_before(store, scope):
    """Private forensic copy before the first Source mutation."""
    directory = Path(scope['evidenceDirectory'])
    directory.mkdir(mode=0o700, parents=False, exist_ok=True)
    if directory.is_symlink() or directory.stat().st_mode & 0o077:
        raise W1Denied('W1_EVIDENCE_PERMISSIONS')
    paths = {'parent-manifest.json': store.base / 'committed.json',
             'bad-current.original': store.objects / scope['parent']['files']['current']['sha256']}
    from source_w1_repair import fingerprint
    for name, source in paths.items():
        target = directory / name
        if target.exists():
            if fingerprint(target) != fingerprint(source):
                raise W1Denied('W1_FORENSIC_COPY_CHANGED')
            continue
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with source.open('rb') as incoming, os.fdopen(fd, 'wb') as outgoing:
            for block in iter(lambda: incoming.read(65536), b''):
                outgoing.write(block)
            outgoing.flush()
            os.fsync(outgoing.fileno())
    from taiko_store.publication import _fsync_directory
    _fsync_directory(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scope')
    parser.add_argument('--materials')
    parser.add_argument('--authorization')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if not args.execute:
        print(json.dumps({'case': 'B1-CURRENT-01', 'state': 'BLOCKED_PENDING_EXPLICIT_W1_AUTHORIZATION', 'productionWrites': 0}))
        return 3
    try:
        if not all((args.scope, args.materials, args.authorization)):
            raise W1Denied('W1_MATERIALS_REQUIRED')
        print(json.dumps(execute(args.scope, args.materials, args.authorization)))
        return 0
    except Exception:
        # Paths, DB exceptions and identities never enter the public log.
        print(json.dumps({'case': 'B1-CURRENT-01', 'state': 'W1_STOPPED_PRIVATE_EVIDENCE_REQUIRED', 'automaticRetry': False}))
        return 2


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    os.umask(0o077)
    # -I intentionally excludes the script directory; import only its peer.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.exit(main())
