# Adapted frozen Sakura test fixture: installed imports only; upstream replies remain synthetic.
"""Execute actual private CLI, with owned SQL and filesystem guards/faults."""
import builtins
import io
import json
import os
from pathlib import Path
import sys
import types
import traceback
import signal
import time
request=json.loads(sys.stdin.buffer.read(65537))
root=Path(os.environ['TAIKO_QQ_TEST_ROOT']).resolve();assert root.is_relative_to(Path(os.environ['QA_RUN_TMPDIR']).resolve()) and root.is_dir()
old_open=builtins.open;old_path_open=Path.open
def guard(path,mode):
    if isinstance(path,(str,bytes,Path)):
        p=Path(path).resolve()
        if str(p).startswith(('/home/sigaer/taiko/userdata/','/home/sigaer/taiko/secrets/')) or str(p)=='/etc/taiko-runtime.env':raise PermissionError('Personal production data forbidden')
        if any(v in mode for v in 'wax+') and root not in p.parents:raise PermissionError('QQ task write outside fixture')
def safe_open(path,*a,**kw):guard(path,a[0] if a else kw.get('mode','r'));return old_open(path,*a,**kw)
def safe_path_open(self,*a,**kw):guard(self,a[0] if a else kw.get('mode','r'));return old_path_open(self,*a,**kw)
builtins.open=safe_open;Path.open=safe_path_open
import importlib.util
assert sys.flags.isolated == 1
for _package in ("taiko_bot", "taiko_store", "runtime_memory"):
    _origin = Path(importlib.util.find_spec(_package).origin).resolve()
    assert _origin.is_relative_to(Path(sys.prefix).resolve()), "Product module outside installed environment"
import pymysql
fault=os.environ.get('TAIKO_QQ_TEST_FAULT');source_injected=False
real_connect=pymysql.connect

class Cursor:
    def __init__(self,c):self.real=c
    @property
    def rowcount(self):return self.real.rowcount
    def execute(self,sql,args=()):
        global source_injected
        result=self.real.execute(sql,args)
        if sql.startswith('INSERT INTO bind'):
            if fault=='signal-expiry':time.sleep(3)
            if fault in {'late-insert','rollback-error'}:raise RuntimeError('Private SQL diagnostic')
            if fault=='late-grant' and not source_injected:
                source_injected=True
                self.real.execute("UPDATE taiko_source_service_grants SET status='revoked' WHERE developer_token_id=%s",(request['actor']['tokenId'],))
            if fault=='late-actor' and not source_injected:
                source_injected=True
                self.real.execute("UPDATE web_developer_tokens SET status='revoked' WHERE id=%s",(request['actor']['tokenId'],))
        if (sql.startswith('UPDATE taiko_qq_migration_codes SET target_principal') or sql.startswith('INSERT INTO taiko_qq_migration_codes')) and fault=='late-QQ':
            self.real.execute("UPDATE web_user_qq_bindings SET status='removed' WHERE user_id=%s",(request['actor']['userId'],))
        return result
    def fetchone(self):return self.real.fetchone()
    def fetchall(self):return self.real.fetchall()
    def close(self):return self.real.close()

class Connection:
    def __init__(self,db):self.real=db
    def cursor(self):return Cursor(self.real.cursor())
    def begin(self):return self.real.begin()
    def commit(self):
        if fault=='before-commit-exit':os._exit(45)
        if fault=='before-commit-error':raise RuntimeError('Private SQL COMMIT')
        self.real.commit()
        if fault=='after-commit-exit':os._exit(46)
        if fault=='after-commit-error':raise RuntimeError('Private SQL ACK')
    def rollback(self):
        if fault=='rollback-error':raise RuntimeError('Private rollback fault')
        return self.real.rollback()
    def close(self):return self.real.close()

def connect(**config):
    assert os.environ.get('TAIKO_ALLOW_TEST_DB_MUTATION')=='1'
    db=real_connect(**config)
    with db.cursor() as cur:
        cur.execute('SELECT DATABASE()');name=cur.fetchone()[0]
        assert name.endswith('_test') and name==os.environ['TAIKO_DB_NAME']
    return Connection(db)
pymysql.connect=connect
sys.stdin=types.SimpleNamespace(buffer=io.BytesIO(json.dumps(request).encode()))
from taiko_bot.cli import qq_migration_cli as cli
real_run=cli.run_viewer_qq_migration
def observed_run(*args,**kwargs):
    try:return real_run(*args,**kwargs)
    except Exception as error:
        entries=[];current=error
        for _ in range(3):
            if current is None:break
            entries.append({'type':type(current).__name__,'sites':[{'file':Path(f.filename).name,'line':f.lineno,'function':f.name} for f in traceback.extract_tb(current.__traceback__)[-3:]]})
            current=current.__context__
        sys.stderr.write(json.dumps({'ownedDiagnostic':entries})+'\n')
        raise
cli.run_viewer_qq_migration=observed_run
if fault=='signal-expiry':
    actual_alarm=signal.alarm
    def short_alarm(seconds):
        assert seconds in (0,45)
        return actual_alarm(1 if seconds else 0)
    signal.alarm=short_alarm
cli.main()
