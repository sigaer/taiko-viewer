"""Real bounded loopback Dev listener; run through the static QA profile."""
import json, os, socket, subprocess, sys, time
from pathlib import Path
from urllib.request import urlopen
sys.path.insert(0,str(Path(__file__).parents[1]))
import admission as a
root=Path(__file__).parents[1]
children=[]
with socket.socket() as probe:
    probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
server="""import os
from http.server import BaseHTTPRequestHandler,HTTPServer
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.end_headers();self.wfile.write(b'owned-dev')
 def log_message(self,*args):pass
HTTPServer((os.environ['HOST'],int(os.environ['PORT'])),Handler).serve_forever()
"""
def start():
    command=[sys.executable,'-c',server]
    args=['qa','--profile','dev','--port',str(port),'--scratch-limit','268435456','--budget-reason','dev-smoke','--',*command]
    code=f'import sys;sys.path.insert(0,{str(root)!r});import qa_vault as q;q.admission.PROFILES["dev"]["seconds"]=10;sys.argv={args!r};sys.exit(q.main())'
    p=subprocess.Popen([sys.executable,'-c',code],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);children.append(p)
    return p,Path(json.loads(p.stdout.readline())['QA_RUN_DIR']).name
try:
    first,task=start();deadline=time.monotonic()+7
    while True:
        try:
            with urlopen(f'http://127.0.0.1:{port}',timeout=.5) as r:assert r.read()==b'owned-dev'
            break
        except OSError:
            if time.monotonic()>deadline:raise
            time.sleep(.1)
    with a.transaction() as rows:
        row=next(r for r in rows if r['task_id']==task)
        assert row['port']==port and row['slice']=='development.slice' and a.populated(row['cgroup'])
    duplicate,_=start();output=duplicate.communicate(timeout=6)[0]
    assert duplicate.returncode==75 and 'dev port already has a listener' in output
    first.communicate(timeout=20);assert first.returncode!=0
    assert not a.populated(row['cgroup'])
    with socket.socket() as probe:assert probe.connect_ex(('127.0.0.1',port))!=0
    with a.transaction() as rows:assert not any(r['task_id']==task for r in rows)
    print(json.dumps(dict(devLoopbackHttp=True,registeredPortAndCgroup=True,duplicatePortRejected=True,deadlineReleasesPortAndLease=True)))
finally:
    for p in children:
        if p.poll() is None:p.terminate()
        try:p.communicate(timeout=15)
        except subprocess.TimeoutExpired:p.kill();p.communicate(timeout=5)
