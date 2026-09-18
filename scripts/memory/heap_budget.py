#!/usr/bin/env python3
"""Prune only the dedicated future-dump directory, never the forensic archive.
Open files are not unlinked. A budget violation while writing is logged as an
error; explicit capture must also run with RLIMIT_FSIZE <= 2 GiB in bounded QA.
"""
import json, os, time
from pathlib import Path
ROOT=Path('/var/lib/taiko/heap-active')
MAX_BYTES=2*1024**3
MAX_FILES=2
RETENTION=7*86400

def main():
 ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
 rows=sorted((p for p in ROOT.glob('*.heapsnapshot') if p.is_file() and not p.is_symlink()),key=lambda p:p.stat().st_mtime)
 opened=set()
 for proc in Path('/proc').glob('[0-9]*'):
  try:
   for fd in (proc/'fd').iterdir():
    try:
     target=os.readlink(fd)
     if target.startswith(str(ROOT)+"/"):opened.add(target)
    except OSError:pass
  except OSError:pass
  try:
   for line in (proc/'maps').read_text().splitlines():
    if str(ROOT)+'/' in line:opened.add(line.split(maxsplit=5)[-1])
  except OSError:pass
 total=sum(p.stat().st_size for p in rows);kept=len(rows);removed=0
 for p in rows:
  st=p.stat()
  if time.time()-st.st_mtime <= RETENTION and total <= MAX_BYTES and kept <= MAX_FILES:continue
  if str(p) in opened:continue
  p.unlink();total-=st.st_size;kept-=1;removed+=1
 expired=sum(1 for p in rows if p.exists() and time.time()-p.stat().st_mtime>RETENTION)
 violation=total>MAX_BYTES or kept>MAX_FILES or expired>0
 print(json.dumps(dict(files=kept,bytes=total,removed=removed,expired_open=expired,budget_violation=violation)))
 return int(violation)
if __name__=='__main__':raise SystemExit(main())
