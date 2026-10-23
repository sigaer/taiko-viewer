"""Reuse the existing MySQL 8 fixture launch pattern; never read prod settings."""
import shutil,json,os,signal,socket,subprocess,time
from pathlib import Path
signal.alarm(240)
root=Path(__file__).resolve().parents[3];out=Path(os.environ['VIEWER_REVIEW_OUT']);out.mkdir(parents=True,exist_ok=True)
scratch=Path(os.environ['QA_RUN_TMPDIR']);data=scratch/'community-mysql-data';sock=scratch/'community-mysql.sock';data.mkdir(mode=0o700)
history=out/'sql-attempts'/os.environ['QA_RUN_ID'];history.mkdir(parents=True,exist_ok=True)
for name in ['mysql-initialize.log','mysql-process.log','mysql.log','sql-http.log','sql-runtime.json']:
 previous=out/name
 if previous.exists():previous.rename(history/name)
assert os.environ.get('TAIKO_ALLOW_TEST_DB_MUTATION')=='1';assert '/development.slice/development-qa.slice/' in Path('/proc/self/cgroup').read_text()
test_file=os.environ.get('COMMUNITY_SQL_TEST_FILE','forumCommunitySqlHttp.test.mjs')
assert test_file in ['forumCommunitySqlHttp.test.mjs','forumCoreSqlHttp.test.mjs','accountEntrySqlHttp.test.mjs']
mysqld='/www/server/mysql/bin/mysqld';daemon=None;result={'pass':False,'productionConnections':0,'productionDataCopied':False}
base=['--no-defaults','--user=root','--basedir=/www/server/mysql','--datadir='+str(data),'--innodb-buffer-pool-size=64M','--innodb-log-file-size=16M','--performance-schema=OFF','--skip-log-bin']
try:
 with (out/'mysql-initialize.log').open('w') as log:subprocess.run([mysqld,*base,'--initialize-insecure'],stdout=log,stderr=log,check=True,timeout=60)
 with (out/'mysql-process.log').open('w') as log:
  daemon=subprocess.Popen([mysqld,*base,'--socket='+str(sock),'--pid-file='+str(scratch/'community-mysql.pid'),'--log-error='+str(out/'mysql.log'),'--skip-networking','--mysqlx=OFF','--event-scheduler=OFF','--skip-slave-start','--local-infile=OFF','--secure-file-priv=NULL','--max-connections=8'],stdout=log,stderr=log)
  for _ in range(200):
   if daemon.poll() is not None:raise RuntimeError('Owned test MySQL exited; see mysql.log')
   try:
    with socket.socket(socket.AF_UNIX) as s:s.connect(str(sock))
    break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('Owned test MySQL readiness timeout')
  inherited={k:v for k,v in os.environ.items() if k in ['PATH','TMPDIR','NODE_OPTIONS','QA_RUN_DIR','QA_EVIDENCE_DIR','QA_RUN_TMPDIR','TAIKO_ALLOW_TEST_DB_MUTATION','VIEWER_REVIEW_OUT']} if test_file=='accountEntrySqlHttp.test.mjs' else os.environ
  env={**inherited,'ANNUAL_E2E_ISOLATED_ROOT':str(scratch/'synthetic-annual'),'COMMUNITY_TEST_SOCKET':str(sock),'TAIKO_DB_HOST':'127.0.0.1','TAIKO_DB_PORT':'1','TAIKO_DB_NAME':'viewer_community_core_test' if test_file=='forumCoreSqlHttp.test.mjs' else 'viewer_community_pr33_test'}
  with (out/'sql-http.log').open('w') as log:subprocess.run(['/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin/node','--experimental-strip-types','--test','--test-concurrency=1','tests/'+test_file],cwd=root/'taiko_viewer',env=env,stdout=log,stderr=log,check=True,timeout=100)
  result['pass']=True
finally:
 if daemon and daemon.poll() is None:
  daemon.terminate()
  try:daemon.wait(timeout=20)
  except subprocess.TimeoutExpired:daemon.kill();daemon.wait()
 if test_file=='accountEntrySqlHttp.test.mjs' and (daemon is None or daemon.poll() is not None):shutil.rmtree(data);result['syntheticDatabaseRemoved']=True
 result['ownedMysqlStopped']=daemon is None or daemon.poll() is not None;result['privateSocketRemoved']=not sock.exists();(out/'sql-runtime.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
