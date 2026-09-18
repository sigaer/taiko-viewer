#!/usr/bin/env python3
"""Small persistent host/cgroup monitor. Never captures command arguments or secrets."""
import argparse, datetime, fcntl, json, os, time
from pathlib import Path

def read(path):
    try: return Path(path).read_text()
    except OSError: return ''

def values(path):
    result = {}
    for line in read(path).splitlines():
        parts = line.replace(':', '').split()
        if len(parts) >= 2 and parts[1].isdigit(): result[parts[0]] = int(parts[1])
    return result

def top_pss():
    rows = []
    for p in Path('/proc').glob('[0-9]*'):
        status = values(p / 'status'); smaps = values(p / 'smaps_rollup')
        if not smaps: continue
        rows.append({'pid': int(p.name), 'name': read(p / 'comm').strip()[:32],
                     'pss_kib': smaps.get('Pss', 0), 'rss_kib': smaps.get('Rss', 0),
                     'swap_kib': status.get('VmSwap', 0), 'cgroup': read(p / 'cgroup').strip()[:180]})
    return sorted(rows, key=lambda x: x['pss_kib'], reverse=True)[:15]

def sample(top):
    mem = values('/proc/meminfo'); vm = values('/proc/vmstat')
    cgroups = {}
    root = Path('/sys/fs/cgroup')
    paths = [root / 'system.slice/taiko-viewer.service', root / 'system.slice/mysqld.service',
             root / 'user.slice/user-0.slice', root / 'taiko-qa.slice']
    paths += list((root / 'system.slice').glob('annual-memory-*.service'))
    paths += list((root / 'system.slice').glob('taiko-qa-*.service'))
    for path in paths:
        if path.exists():
            cgroups[str(path.relative_to(root))] = {k: read(path / k).strip() for k in
                ('memory.current', 'memory.swap.current', 'memory.events', 'memory.pressure')}
    return {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'mem_kib': {k: mem.get(k, 0) for k in ('MemTotal', 'MemAvailable', 'SwapTotal', 'SwapFree', 'Shmem', 'Slab')},
            'vm': {k: vm.get(k, 0) for k in ('pswpin', 'pswpout', 'pgmajfault', 'pgpgin', 'pgpgout')},
            'psi': {k: read('/proc/pressure/' + k).strip() for k in ('memory', 'io', 'cpu')},
            'diskstats': [line for line in read('/proc/diskstats').splitlines() if any(device in line.split() for device in ('vda', 'sda', 'nvme0n1'))],
            'cpu': read('/proc/stat').splitlines()[0], 'load': read('/proc/loadavg').strip(),
            'cgroups': cgroups, 'top_pss': top}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--directory', default='/var/log/taiko-memory')
    parser.add_argument('--once', action='store_true'); args = parser.parse_args()
    directory = Path(args.directory); directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (directory / '.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        tick = 0
        while True:
            start = time.monotonic(); now = time.time()
            top = top_pss() if tick % 4 == 0 else None
            record = sample(top)
            path = directory / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d') + '.jsonl')
            # Normal output ~10 MiB/day. Hard cap bounds disk use during anomalies.
            if not path.exists() or path.stat().st_size < 32 * 1024**2:
                with path.open('a') as f: f.write(json.dumps(record, separators=(',', ':')) + '\n')
                os.chmod(path, 0o600)
            if tick % 240 == 0:
                for old in directory.glob('????-??-??.jsonl'):
                    if now - old.stat().st_mtime > 14 * 86400: old.unlink()
            if args.once: return
            tick += 1; time.sleep(max(0, 15 - (time.monotonic() - start)))

if __name__ == '__main__': main()
