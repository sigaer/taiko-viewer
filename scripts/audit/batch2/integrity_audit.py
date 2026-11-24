"""Forensics only. Raw files + SELECT in a read-only transaction; no store/API imports."""
import collections, datetime as dt, hashlib, json, math, os, re, shutil, time
from pathlib import Path
from zoneinfo import ZoneInfo
import pymysql
from dotenv import dotenv_values

BASE=Path('/var/tmp/taiko-batch2-20261124');PRIVATE=BASE/'evidence/integrity-private';PRIVATE.mkdir(mode=0o700,exist_ok=True)
OUT=BASE/'integration/docs/catalog-release-batch2-20261124/integrity';OUT.mkdir(parents=True,exist_ok=True)
ROOT=Path('/home/sigaer/taiko/userdata');deadline=time.monotonic()+360
def check():
    if time.monotonic()>deadline:raise TimeoutError('forensic deadline')
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def save(name,obj,private=False):
    ((PRIVATE if private else OUT)/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,default=str)+'\n')
def signature(p):
    s=p.stat();return {'dev':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'links':s.st_nlink,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
pub=[];anomalies=[]
for path in sorted((ROOT/'.taiko-publications').glob('*/committed.json')):
    check();raw=path.read_bytes();m=json.loads(raw);ref=m.get('files',{}).get('current')
    if not ref:continue
    obj=path.parent/'objects'/ref['sha256'];projection=ROOT/(path.parent.name+'data.json')
    rec={'identity':path.parent.name,'commitId':m.get('commitId'),'sequence':m.get('sequence'),'manifestHash':hashlib.sha256(raw).hexdigest(),'reference':ref,'stableManifest':raw==path.read_bytes()}
    try:
        before=signature(obj);digest=sha(obj);after=signature(obj);ps=signature(projection) if projection.exists() else None
        rec.update(object=before,actualSha256=digest,stableObject=before==after,projection=ps,sameInode=ps is not None and (ps['dev'],ps['inode'])==(before['dev'],before['inode']))
        bad=digest!=ref['sha256'] or before['bytes']!=ref['bytes']
    except FileNotFoundError:rec['missing']=True;bad=True
    pub.append(rec)
    if bad:
        slot=PRIVATE/('publication-'+str(len(anomalies)+1));slot.mkdir(mode=0o700,exist_ok=True)
        (slot/'committed.json').write_bytes(raw)
        if obj.exists():shutil.copyfile(obj,slot/'object.raw')
        if projection.exists():shutil.copyfile(projection,slot/'projection.raw')
        historical=[];seen={}
        for p in sorted((path.parent/'commits').glob('*.json')):
            check();v=json.loads(p.read_bytes());refs=v.get('files',{});entry={'manifest':p.name,'sha256':sha(p),'commitId':v.get('commitId'),'sequence':v.get('sequence'),'current':refs.get('current'),'keys':len(refs)}
            for key,r in refs.items():
                if r and r.get('sha256')==ref['sha256']:entry.setdefault('corruptObjectKeys',[]).append(key)
            historical.append(entry);shutil.copyfile(p,slot/p.name)
        rec['historical']=historical
        rec['pendingExists']=(path.parent/'pending.json').exists()
        anomalies.append(rec)
save('publication-current-private.json',pub,True);save('publication-anomalies-private.json',anomalies,True)
save('publication-summary.json',{'qaRun':os.environ['QA_RUN_ID'],'currentObjectsHashed':len(pub),'anomalies':[{'case':i+1,**{k:v for k,v in x.items() if k not in ('identity','historical','commitId')}} for i,x in enumerate(anomalies)],'privateEvidence':str(PRIVATE)})
events=[json.loads(x) for x in (BASE/'evidence/measurement-journal.raw.jsonl').read_text().splitlines()]
pairs=[]
for x in events:
    pair=tuple(map(int,re.findall(r'(?:userId|bindingId): (\d+)',x['MESSAGE'])))
    if pair not in pairs:pairs.append(pair)
env=dotenv_values('/etc/taiko-viewer.env')
db=pymysql.connect(host=env.get('TAIKO_DB_HOST','127.0.0.1'),port=int(env.get('TAIKO_DB_PORT','3306')),user=env['TAIKO_DB_USER'],password=env['TAIKO_DB_PASSWORD'],database=env.get('TAIKO_DB_NAME','taiko'),connect_timeout=5,read_timeout=15,write_timeout=5,cursorclass=pymysql.cursors.DictCursor,autocommit=False)
groups=[];ledger=[]
try:
    with db.cursor() as c:
        c.execute('SET TRANSACTION READ ONLY');c.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT')
        c.execute('SELECT DATABASE() AS selected_database')
        tx=c.fetchone()
        for n,(uid,bid) in enumerate(pairs,1):
            check();c.execute('SELECT id,user_id,taiko_id FROM web_taiko_bindings WHERE id=%s AND user_id=%s',(bid,uid));binding=c.fetchone()
            c.execute('SELECT id,score_revision,measurement_version,algorithm_version,model_revision,sample_count,availability_state,captured_at FROM web_growth_measurements WHERE binding_id=%s AND user_id=%s ORDER BY captured_at,id LIMIT 10000',(bid,uid));measurements=c.fetchall()
            g={'group':n,'userId':uid,'bindingId':bid,'binding':binding,'measurements':measurements,'archive':None};groups.append(g)
            if binding:
                identity=str(binding['taiko_id']);archive=ROOT/identity/'daily-ability-v1-top20.json'
                if archive.exists():
                    g['archive']={'path':str(archive),'sha256':sha(archive),'stat':signature(archive),'payload':json.loads(archive.read_bytes())}
                    shutil.copyfile(archive,PRIVATE/f'measurement-group-{n}-archive.raw.json')
                history=[]
                for p in sorted((ROOT/identity).glob('data_*.json')):
                    check();s=p.stat()
                    if '20261122' in p.name or '20261123' in p.name:history.append({'name':p.name,'sha256':sha(p),'stat':signature(p)})
                g['scoreHistory']=history
            for x in events:
                eventpair=tuple(map(int,re.findall(r'(?:userId|bindingId): (\d+)',x['MESSAGE'])))
                if eventpair!=(uid,bid):continue
                captured=dt.datetime.fromtimestamp(int(x['__REALTIME_TIMESTAMP'])/1e6,dt.timezone.utc);day=captured.astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
                row=g['archive']['payload'].get('days',{}).get(day) if g['archive'] else None
                onday=[r for r in measurements if (r['captured_at'].replace(tzinfo=dt.timezone.utc).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()==day)]
                ledger.append({'cursor':x.get('__CURSOR'),'utc':captured.isoformat(),'shanghaiDay':day,'group':n,'error':'Invalid daily ability point','writerArchiveRow':row,'existingMeasurementsOnDay':onday,'scoreRevisionAtFailure':None,'revisionEvidence':'Error logger omits scoreRevision; no exact request payload retained','currentArchiveHash':g['archive']['sha256'] if g['archive'] else None})
finally:
    db.rollback();db.close()
save('measurement-groups-private.json',groups,True);save('measurement-events-private.json',ledger,True)
redacted=[]
for i,x in enumerate(sorted(ledger,key=lambda x:x['utc']),1):
    row=x['writerArchiveRow'] or {};redacted.append({'event':i,'utc':x['utc'],'shanghaiDay':x['shanghaiDay'],'group':x['group'],'originalEleven':i<=11,'error':x['error'],'archiveRowPresent':bool(row),'sampleCount':row.get('sampleCount'),'ratingFinite':isinstance(row.get('rating'),(int,float)) and math.isfinite(row['rating']),'capturedAt':row.get('capturedAt'),'computedAt':row.get('computedAt'),'origin':row.get('origin'),'existingMeasurementsOnDay':len(x['existingMeasurementsOnDay']),'scoreRevisionAtFailure':None,'revisionEvidence':x['revisionEvidence']})
save('measurement-event-matrix.json',{'qaRun':os.environ['QA_RUN_ID'],'events':redacted,'affectedGroups':len(groups),'readOnlyTransaction':True,'dbServerReported':tx,'exactHistoricalRequestRevisionsKnown':0,'evidenceLimit':'Current archive and DB observations are later than failure; cannot prove absence at failure or recover unlogged revisions.'})
print(json.dumps({'currentObjects':len(pub),'publicationAnomalies':len(anomalies),'measurementEvents':len(ledger),'affectedGroups':len(groups),'qaRun':os.environ['QA_RUN_ID']}))
