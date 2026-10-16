"""Exec the existing canonical CLI inside its dedicated cgroup; no model changes."""
import json, os, sys, time, math, signal
with open(sys.argv[1], encoding='utf-8') as handle:
    config = json.load(handle)
os.unlink(sys.argv[1])
remaining = config.get('deadlineMs', time.time()*1000+240000)/1000-time.time()
if remaining <= 0:
    raise SystemExit(124)
# alarm survives exec: a delayed systemd/DBus launch cannot outlive its lease.
signal.alarm(max(1, math.ceil(remaining)))
os.chdir(config['cwd'])
os.execvpe(sys.executable, [sys.executable, *config['args']], config['env'])
