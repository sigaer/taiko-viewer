#!/usr/bin/env python3
"""Independent fail-closed supervisor; invoke inside scripts/memory/run_qa.sh."""
import json, os, signal, subprocess, sys, time
from pathlib import Path
if len(sys.argv)!=2:
    sys.exit('Usage: run-annual-readiness.py /private/config.json')
c=json.loads(Path(sys.argv[1]).read_text())
if not c.get('serverPid'):
    sys.exit('BLOCKED: isolated serverPid is required; no traffic sent')
pid=int(c['serverPid'])
start_id=Path(f'/proc/{pid}/stat').read_text().split()[21]
child=subprocess.Popen(['node','loadtest/annual-readiness.mjs',sys.argv[1]],start_new_session=True)
samples=[]; reason=None; start=time.monotonic()
def stop(*_):
    global reason
    reason=reason or 'interrupted'
    if child.poll() is None: os.killpg(child.pid,signal.SIGTERM)
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
try:
    while child.poll() is None:
        try:
            mem={line.split(':')[0]:int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
            identity=Path(f'/proc/{pid}/stat').read_text().split()[21]
            pressure=Path('/proc/pressure/memory').read_text()
            full=float(pressure.split('full avg10=')[1].split()[0])
            sample={'elapsed':time.monotonic()-start,'availableMiB':mem['MemAvailable']/1024,'fullPsi':full,
                    'vmstat':Path('/proc/vmstat').read_text(), 'cpu':Path('/proc/stat').read_text().splitlines()[0],
                    'io':Path(f'/proc/{pid}/io').read_text(),'network':Path('/proc/net/dev').read_text()}
            samples.append(sample)
            if identity!=start_id: reason='server-restarted'
            if mem['MemAvailable']/1024<c['minAvailableMiB'] or full>=c['maxMemoryPsiFull']: reason='host-pressure'
            if time.monotonic()-start>850: reason='hard-deadline'
        except Exception: reason='monitor-unavailable'
        if reason:
            stop()
            try: child.wait(timeout=15)
            except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL)
            break
        time.sleep(1)
finally:
    if child.poll() is None: stop()
    code=child.wait()
    # Save outside the repo; never include configuration, cookies or process args.
    out=Path('/var/tmp/annual-readiness-supervisor-'+str(os.getpid())+'.json')
    out.write_text(json.dumps({'reason':reason,'exitCode':code,'samples':samples},indent=2))
    print('Supervisor evidence:',out)
sys.exit(code if code else (1 if reason else 0))
