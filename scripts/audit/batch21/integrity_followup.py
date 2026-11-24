"""Read raw forensic evidence only; no PublicationStore, app or DB imports."""
import collections,datetime,hashlib,json,os
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');old=Path('/var/tmp/taiko-batch2-20261124/evidence/integrity-private')
private=BASE/'evidence/integrity-private';private.mkdir(mode=0o700,exist_ok=True)
out=BASE/'viewer/docs/wahlap-authority-b21-20261124/integrity';out.mkdir(exist_ok=True)
anomaly=json.loads((old/'publication-anomalies-private.json').read_text())[0]
root=Path('/home/sigaer/taiko/userdata/.taiko-publications')/anomaly['identity']
manifest=(root/'committed.json').read_bytes();current=json.loads(manifest);ref=current['files']['current']
obj=root/'objects'/ref['sha256'];projection=root.parent.parent/(anomaly['identity']+'data.json')
def sig(path):
 s=path.stat();return {'dev':s.st_dev,'inode':s.st_ino,'links':s.st_nlink,'bytes':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
before=sig(obj);raw=obj.read_bytes();after=sig(obj)
for name,data in [('current-manifest.raw',manifest),('current-object.raw',raw),('current-projection.raw',projection.read_bytes())]:
 path=private/name
 with path.open('xb') as stream:stream.write(data)
actual=json.loads(raw);versions=[];diffs=[]
for path in sorted((root/'commits').glob('*.json')):
 value=json.loads(path.read_bytes());reference=value.get('files',{}).get('current')
 if not reference:continue
 body=(root/'objects'/reference['sha256']).read_bytes()
 valid=hashlib.sha256(body).hexdigest()==reference['sha256'] and len(body)==reference['bytes']
 versions.append({'sequence':value.get('sequence'),'expectedHash':reference['sha256'],'actualHash':hashlib.sha256(body).hexdigest(),'bytes':len(body),'valid':valid})
 if valid:
  previous=json.loads(body)
  def compare(a,b,path=()):
   if type(a)!=type(b):diffs.append({'path':path,'kind':'TYPE_CHANGED'});return
   if isinstance(a,dict):
    for key in a.keys()|b.keys():
     if key not in a or key not in b:diffs.append({'path':(*path,key),'kind':'KEY_MEMBERSHIP'})
     else:compare(a[key],b[key],(*path,key))
   elif isinstance(a,list):
    if len(a)!=len(b):diffs.append({'path':path,'kind':'LIST_LENGTH'})
    for i,(x,y) in enumerate(zip(a,b)):compare(x,y,(*path,i))
   elif a!=b:diffs.append({'path':path,'kind':'VALUE_CHANGED'})
  compare(previous,actual)
(private/'historical-current-field-diffs.json').write_text(json.dumps(diffs,ensure_ascii=False,indent=2))
fds=[];pids=0;deadline=datetime.datetime.now().timestamp()+20
for pid in Path('/proc').iterdir():
 if not pid.name.isdigit():continue
 pids+=1
 if pids>4096 or datetime.datetime.now().timestamp()>deadline:break
 try:
  for fd in list((pid/'fd').iterdir())[:1024]:
   try:
    st=fd.stat()
    if (st.st_dev,st.st_ino)==(before['dev'],before['inode']):
     fds.append({'pid':int(pid.name),'comm':(pid/'comm').read_text().strip(),'fd':fd.name,'info':(pid/'fdinfo'/fd.name).read_text()})
   except OSError:pass
 except OSError:pass
(private/'current-open-fds.json').write_text(json.dumps(fds,indent=2))
public={'qaRun':os.environ['QA_RUN_ID'],'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'manifestSha256':hashlib.sha256(manifest).hexdigest(),'expected':ref,
 'actualSha256':hashlib.sha256(raw).hexdigest(),'object':before,'stableRead':before==after,
 'projection':sig(projection),'historicalCurrentReferences':versions,'fieldDifferencesBetweenGenerations':len(diffs),
 'fieldDifferenceKinds':dict(collections.Counter(d['kind'] for d in diffs)),
 'openDescriptorsAtObservation':len(fds),'pidDirectoriesInspected':pids,'auditLogPresent':Path('/var/log/audit/audit.log').is_file(),
 'pending':(root/'pending.json').exists(),'historicalWriter':'UNKNOWN',
 'impact':'Previously confirmed one current binding. Current Publication consumers reject hash/size; no production HTTP probe or recovery performed.',
 'evidenceLimit':'A valid older generation is not the pre-corruption bytes of the current generation; field differences do not identify the writer.'}
(out/'publication-followup.json').write_text(json.dumps(public,indent=2)+'\n')
events=json.loads((BASE/'viewer/docs/catalog-release-batch2-20261124/integrity/measurement-event-matrix.json').read_text())
for event in events['events']:
 event.update(classification='READER_REJECTION',pythonArchiveWriter='EXECUTED',viewerSqlWriter='NOT_ENTERED',
  persistenceFailure='NOT_OBSERVED',retry='REPEATED_REQUEST_REJECTION_NO_SUCCESS_EVIDENCE',
  actualMissingMeasurement='NO_SQL_ROW_ON_AFFECTED_DAY_AT_BATCH2_OBSERVATION',actualScoreLoss='NOT_OBSERVED',scoreRevision='unknown')
events['provenance']='Reclassification of preserved Batch2 exact journal/archive/SELECT evidence; no new DB writes or inferred historical revisions.'
(out/'measurement-14-events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'publication':public,'measurementEvents':len(events['events'])}))
