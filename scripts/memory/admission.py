"""Host resource leases. The mutex protects admission metadata, never job execution.

Linux/systemd only; failures are closed. No command lines or secrets in the ledger.
Budgets are bytes and CPU percent (100 = one CPU). A dead supervisor does not
release a populated cgroup; systemd's hard deadline bounds orphan lifetime.
"""
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import socket
import time

GIB = 1024 ** 3
CG = Path('/sys/fs/cgroup')
ROOT = Path('/run/taiko-resource-admission')
LOCK = Path('/run/lock/taiko-memory-qa.lock')
LAST_TRANSACTION_METRICS = {}
PROFILES = {
    'static': dict(memory=512*1024**2, high=384*1024**2, cpu=50, scratch=256*1024**2, seconds=900, heap=256, slice='development-qa.slice'),
    'qa': dict(memory=2560*1024**2, high=2*GIB, cpu=200, scratch=2*GIB, seconds=900, heap=1536, slice='development-qa.slice'),
    'browser': dict(memory=2*GIB, high=1536*1024**2, cpu=150, scratch=2*GIB, seconds=900, heap=1024, slice='development-qa.slice'),
    'build': dict(memory=5*GIB, high=4*GIB, cpu=200, scratch=4*GIB, seconds=1800, heap=4096, slice='development-build.slice'),
    'dev': dict(memory=3*GIB, high=2*GIB, cpu=100, scratch=2*GIB, seconds=14400, heap=1536, slice='development.slice'),
}

class Deferred(RuntimeError):
    pass

def number(path, default=None):
    try:
        raw = path.read_text().strip()
    except FileNotFoundError:
        if default is not None:
            return default
        raise
    if raw == 'max':
        raise Deferred('unbounded cgroup: ' + str(path))
    return int(raw)

def pid_identity(pid):
    try:
        return Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    except FileNotFoundError:
        return None

def populated(group):
    try:
        return 'populated 1' in (CG / group.lstrip('/') / 'cgroup.events').read_text()
    except FileNotFoundError:
        return False

def reap(rows, boot, now):
    active = []
    for row in rows:
        if row['boot_id'] != boot:
            continue
        alive = pid_identity(row['pid']) == row['pid_start']
        busy = populated(row['cgroup'])
        if busy or (alive and now < row['expiry']):
            row['status'] = 'running' if alive and now < row['expiry'] else 'orphan-cgroup'
            active.append(row)
    return active

def vm_swap():
    data = dict(line.split() for line in Path('/proc/vmstat').read_text().splitlines())
    return int(data['pswpin']) + int(data['pswpout'])

def deployment_active():
    try:
        fd = os.open('/tmp/taiko-viewer-deploy.lock', os.O_RDWR | os.O_NOFOLLOW)
    except FileNotFoundError:
        return False
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return False
        except BlockingIOError:
            return True
    finally:
        os.close(fd)


def snapshot():
    # Sampling is outside the mutex. Refresh counters/pressure under the lock too.
    start = vm_swap(); then = time.monotonic(); time.sleep(.2)
    swap = (vm_swap()-start)*os.sysconf('SC_PAGE_SIZE')/(time.monotonic()-then)
    mem = {line.split(':')[0]: int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()}
    pressure = float(re.search(r'full avg10=([\d.]+)', Path('/proc/pressure/memory').read_text())[1])
    parent = CG / 'development.slice'
    disk = os.statvfs('/var/tmp')
    groups = {str(p.parent.relative_to(CG)): int(p.read_text()) for p in parent.rglob('memory.current')}
    units = []
    for directory in parent.rglob('*'):
        if directory.suffix not in {'.service', '.scope'} or not directory.is_dir():
            continue
        if any(p.suffix in {'.service', '.scope'} for p in directory.relative_to(parent).parents):
            continue
        if number(directory/'pids.current', 0):
            quota, period = (directory/'cpu.max').read_text().split()
            cpu = os.cpu_count()*100 if quota == 'max' else (int(quota)*100 + int(period)-1)//int(period)
            units.append(dict(group=str(directory.relative_to(CG)), current=number(directory/'memory.current'), maximum=number(directory/'memory.max'), cpu_budget=cpu))
    if (parent/'cgroup.procs').read_text().strip():
        raise Deferred('unregistered direct development.slice processes require an explicit budget')
    annual = sum(number(p, 0) for p in (CG/'system.slice').glob('taiko-annual-*.service/pids.current'))
    return dict(deploy_active=deployment_active(), total=mem['MemTotal'], available=mem['MemAvailable'], psi=pressure, swap_bps=swap,
                parent=number(parent/'memory.current'), parent_max=number(parent/'memory.max'),
                qa=number(parent/'development-qa.slice/memory.current', 0),
                qa_max=number(parent/'development-qa.slice/memory.max'),
                build_pids=number(parent/'development-build.slice/pids.current', 0),
                build_max=number(parent/'development-build.slice/memory.max'),
                groups=groups, units=units, annual_pids=annual, free=disk.f_bavail*disk.f_frsize,
                disk_total=disk.f_blocks*disk.f_frsize, cpu_limit=max(100, (os.cpu_count()-2)*100))

def reasons(request, rows, host):
    missing = lambda r: max(0, r['memory_budget']-host['groups'].get(r['cgroup'].lstrip('/'), 0))
    pending = sum(missing(r) for r in rows)
    parent_charge, qa_charge = host['parent'], host['qa']
    if 'units' in host:
        known = {r['cgroup'].lstrip('/') for r in rows}
        charge = lambda u: u['current'] if u['group'] in known else max(u['current'], u['maximum'])
        parent_charge = sum(charge(u) for u in host['units'])
        qa_charge = sum(charge(u) for u in host['units'] if '/development-qa.slice/' in u['group'])
        pending += sum(max(0,u['maximum']-u['current']) for u in host['units'] if u['group'] not in known)
        # Idle/dead-unit cache remains visible in host['parent']/['qa']; it is
        # reclaimable shared capacity, not a permanent lease. MemAvailable and
        # the unchanged slice hard limits still account for physical pressure.
        # Unknown live units are reserved at their hard limit, never just RSS.
        unknown_pending = sum(max(0,u['maximum']-u['current']) for u in host['units'] if u['group'] not in known)
    else:
        unknown_pending = 0
    if host.get('deploy_active') and request['workload_type'] != 'build' and not any(r['workload_type'] == 'build' for r in rows):
        pending += 5*GIB  # Unregistered legacy deployment's worst-case build reservation.
    memory = request['memory_budget']
    out = []
    # 25% host reserve + 1 GiB kernel/admin allowance, plus unconsumed leases.
    required = host['total']//4 + GIB + pending + memory
    if host['available'] < required:
        out.append(f'host memory available={host["available"]} required={required}')
    if host['psi'] >= 2:
        out.append(f'memory PSI full avg10={host["psi"]} >= 2')
    if host['swap_bps'] > 8*1024**2:
        out.append(f'active swap IO bytes/sec={int(host["swap_bps"])} > 8388608')
    if parent_charge + pending - unknown_pending + memory > host['parent_max']:
        out.append('development.slice aggregate reservation exceeds MemoryMax')
    if request['slice'] == 'development-qa.slice':
        qa_pending = sum(missing(r) for r in rows if r['slice'] == request['slice'])
        if qa_charge + qa_pending + memory > host['qa_max']:
            out.append('QA aggregate reservation exceeds MemoryMax')
    if request['workload_type'] == 'build':
        if memory > host['build_max']:
            out.append('build reservation exceeds build slice')
        if host['build_pids'] or any(r['workload_type'] == 'build' for r in rows):
            out.append('heavy build already active')
        if host['annual_pids']:
            out.append('Annual worker active')
    if request['workload_type'] != 'static':
        if any(r['worktree'] == request['worktree'] and r['workload_type'] != 'static' for r in rows):
            out.append('worktree already has a mutable task')
    if request.get('port') and any(r.get('port') == request['port'] for r in rows):
        out.append('dev port already reserved')
    known_groups = {r['cgroup'].lstrip('/') for r in rows}
    unknown_cpu = sum(u.get('cpu_budget', 0) for u in host.get('units', []) if u['group'] not in known_groups)
    if sum(r['cpu_budget'] for r in rows) + unknown_cpu + request['cpu_budget'] > host['cpu_limit']:
        out.append('development CPU reservations exceed host minus two CPUs')
    disk_reserved = sum(r['scratch_budget'] for r in rows) + request['scratch_budget']
    # Current 315 GiB volume: retain 5% (~15.7 GiB), above old 5 GiB floor.
    floor = max(5*GIB, host['disk_total']//20)
    if host['free'] - disk_reserved < floor:
        out.append(f'disk available={host["free"]} reserved={disk_reserved} floor={floor}')
    return out

@contextlib.contextmanager
def transaction():
    global LAST_TRANSACTION_METRICS
    ROOT.mkdir(mode=0o700, exist_ok=True)
    info = ROOT.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise Deferred('unsafe registry directory')
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.geteuid():
            raise Deferred('unsafe admission lock')
        wait_started = time.monotonic()
        deadline = wait_started + .5
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise Deferred('admission mutex busy for 500ms; legacy maintenance or stalled transaction')
                time.sleep(.01)
        held_started = time.monotonic()
        path = ROOT/'leases.json'
        rows = json.loads(path.read_text()) if path.exists() else []
        rows = reap(rows, Path('/proc/sys/kernel/random/boot_id').read_text().strip(), time.time())
        try:
            yield rows
        finally:
            temp = ROOT/f'leases-{os.getpid()}.next'
            with temp.open('w') as stream:
                json.dump(rows, stream); stream.flush(); os.fsync(stream.fileno())
            os.replace(temp, path)
            LAST_TRANSACTION_METRICS = dict(waitMs=(held_started-wait_started)*1000, heldMs=(time.monotonic()-held_started)*1000)
    finally:
        os.close(fd)

def acquire(task_id, profile, unit, scratch, port=None):
    p = PROFILES[profile]
    if profile == 'dev' and not port:
        raise Deferred('dev requires TAIKO_DEV_PORT and explicit listener configuration')
    if profile == 'dev':
        if not 1024 < port <= 65535:
            raise Deferred('dev port outside unprivileged TCP range')
        try:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', port))
        except OSError:
            raise Deferred('dev port already has a listener')
    group = '/development.slice/' + (p['slice']+'/' if p['slice'] != 'development.slice' else '') + unit+'.service'
    worktree = Path.cwd().resolve()
    for parent in [worktree, *worktree.parents]:
        if (parent/'.git').exists():
            worktree = parent
            break
    row = dict(task_id=task_id, owner=os.geteuid(), workload_type=profile, worktree=str(worktree),
               cgroup=group, memory_budget=p['memory'], cpu_budget=p['cpu'], scratch_budget=scratch,
               start_time=time.time(), expiry=time.time()+p['seconds']+60, status='reserved', slice=p['slice'],
               pid=os.getpid(), pid_start=pid_identity(os.getpid()), boot_id=Path('/proc/sys/kernel/random/boot_id').read_text().strip(), port=port)
    host = snapshot()
    with transaction() as rows:
        # Refresh fast volatile metrics after taking the mutex; all reservations
        # are read here, so two simultaneous applicants cannot oversubscribe.
        host['available'] = int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
        failed = reasons(row, rows, host)
        if failed:
            raise Deferred('; '.join(failed))
        rows.append(row)
    return dict(lease=row, host=host, mutex=dict(LAST_TRANSACTION_METRICS))

def release(task_id):
    with transaction() as rows:
        rows[:] = [r for r in rows if r['task_id'] != task_id or populated(r['cgroup'])]


@contextlib.contextmanager
def annual_start_barrier(enabled):
    """Bridge existing Annual admission until the build cgroup is visible.

    Only held during systemd startup (maximum five seconds), never the build.
    Existing running tickets cover the gap before their worker cgroup appears.
    """
    descriptors = []
    try:
        if enabled:
            root = Path('/var/lib/taiko/annual-admission')
            for resource in ['generator', 'renderer']:
                path = root/(resource+'.lock')
                if not path.exists():
                    raise Deferred('Annual admission lock unavailable; cannot prove startup exclusion')
                fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
                descriptors.append(fd)
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    raise Deferred('Annual admission transaction active')
                ledger = root/(resource+'.json')
                rows = json.loads(ledger.read_text()) if ledger.exists() else []
                if any(r['state'] == 'running' and r['until'] > time.time()*1000 for r in rows):
                    raise Deferred('Annual ticket running or starting')
        yield
    finally:
        for fd in descriptors:
            os.close(fd)
