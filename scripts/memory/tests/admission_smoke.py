"""Real systemd tests. Invoke through the static QA profile; no production calls."""
import json,os,signal,subprocess,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]))
import admission as a
root=Path(__file__).parents[1]
children=[]
def start(seconds=4,deadline=10,profile="static"):
    code=f'import sys;sys.path.insert(0,{str(root)!r});import qa_vault as q;q.admission.PROFILES[{profile!r}]["seconds"]={deadline};sys.argv=["qa","--profile",{profile!r},"--scratch-limit","268435456","--budget-reason","smoke","--","/bin/sleep",{str(seconds)!r}];sys.exit(q.main())'
    p=subprocess.Popen([sys.executable,'-c',code],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    children.append(p)
    line=p.stdout.readline(); data=json.loads(line); return p,Path(data['QA_RUN_DIR']).name

def leases():
    with a.transaction() as rows:return json.loads(json.dumps(rows))

def await_row(task):
    until=time.monotonic()+8
    while time.monotonic()<until:
        row=next((r for r in leases() if r['task_id']==task),None)
        if row and a.populated(row['cgroup']):return row
        time.sleep(.1)
    raise AssertionError('owned cgroup did not start')

result={}
try:
    first,id1=start(); await_row(id1)
    second,id2=start(); await_row(id2)
    assert first.poll() is None and second.poll() is None
    result['simultaneousStatic']=True
    for p in [first,second]:
        p.communicate(timeout=15); assert p.returncode==0
    assert not any(r['task_id'] in [id1,id2] for r in leases())
    result['normalRelease']=True
    reserved,rid=start(profile='qa'); await_row(rid)
    rejected,jid=start()
    output=rejected.communicate(timeout=8)[0]
    assert rejected.returncode==75 and 'QA aggregate reservation' in output
    assert not any(r['task_id']==jid for r in leases())
    reserved.communicate(timeout=15); assert reserved.returncode==0
    result['realQaBudgetRejectionWithoutLaunchingChild']=True
    timed,tid=start(seconds=30,deadline=2); row=await_row(tid)
    timed.communicate(timeout=15); assert timed.returncode!=0
    assert not a.populated(row['cgroup']) and not any(r['task_id']==tid for r in leases())
    result['systemdTimeoutRelease']=True
    crashed,cid=start(seconds=30,deadline=3); row=await_row(cid)
    crashed.kill(); crashed.wait(timeout=3)
    assert any(r['task_id']==cid and r['status']=='orphan-cgroup' for r in leases())
    until=time.monotonic()+10
    while a.populated(row['cgroup']) and time.monotonic()<until:time.sleep(.1)
    assert not a.populated(row['cgroup'])
    assert not any(r['task_id']==cid for r in leases())
    result['crashRetainsUntilCgroupExitThenReaps']=True
    print(json.dumps(result))
finally:
    for p in children:
        if p.poll() is None:p.terminate()
        try:p.communicate(timeout=15)
        except subprocess.TimeoutExpired:p.kill();p.communicate(timeout=5)
