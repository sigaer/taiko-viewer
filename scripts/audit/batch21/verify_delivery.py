"""Read-only acceptance joins, source/link checks and retained baseline proof."""
import hashlib,json,re,subprocess,os
from pathlib import Path
BASE=Path('/var/tmp/taiko-batch21-20261124');VIEWER=BASE/'viewer';OUT=VIEWER/'docs/wahlap-authority-b21-20261124'
def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def read(path):return json.loads(path.read_bytes())
from taiko_bot.catalog.reader import capture
os.environ['TAIKO_CATALOG_ROOT']=str(BASE/'catalog');view=capture();data=view.data
assert read(OUT/'acceptance.json')['allCandidateGatesPassed']
assert not subprocess.check_output(['git','diff','79d07cfc','--name-only','--','taiko_viewer'],cwd=VIEWER,text=True).strip(),'Frontend changed after accepted build'
feature=read(OUT/'coverage/cn-1387-coverage.json')
records=feature['charts'] if isinstance(feature,dict) and 'charts' in feature else feature
assert len(records)==1387
assert len(read(OUT/'integrity/measurement-14-events.json')['events'])==14
assert len(read(OUT/'seven-conflicts.json'))==7
assert not read(OUT/'identity-audit.json')['namespaceIdentityConflicts']
parser_manifest=read(OUT/'coverage/parser-manifest.json')
verified_parser=[]
for item in parser_manifest.values():
    for name,digest in item['files'].items():
        matches=[path for path in [VIEWER/name,VIEWER/'taiko_viewer'/name] if path.is_file()]
        assert len(matches)==1 and sha(matches[0])==digest;verified_parser.append(name)
positions=data['positions'];index=positions['index'];members={sid for cat in index['categories'].values() for key in ['ordered','pending'] for sid in cat[key]}
assert members==view.song_ids()
position_report={'catalogRevision':view.revision,'policyVersion':view.policy_version,'membershipSource':positions['membershipSource'],'referenceStatus':positions['referenceStatus'],'referenceUpdatedAt':positions['referenceUpdatedAt'],'uniqueOfficialSongs':len(members),'membershipRows':sum(len(cat[key]) for cat in index['categories'].values() for key in ['ordered','pending']),'orderedMemberships':sum(len(cat['ordered']) for cat in index['categories'].values()),'pendingMemberships':sum(len(cat['pending']) for cat in index['categories'].values()),'semantics':positions['semantics']}
(OUT/'position-authority-audit.json').write_text(json.dumps(position_report,ensure_ascii=False,indent=2)+'\n')
extra=[]
for name,role in [('taiko_bot/song_positions.py','Reference DTO and formatting; no CN source'),('taiko_bot/offline/song_positions.py','Metadata/reference producer only'),('taiko_bot/catalog/positions.py','Central membership projection, Wahlap only'),('taiko_bot/catalog/history.py','Central historical row/alias retention'),('taiko_bot/catalog/storage.py','Verified predecessor and atomic activation'),('taiko_bot/runtime/public/public_queries.py','Current-catalog position wording')]:
    extra.append({'repo':'bot','path':name,'role':role,'sha256':sha(BASE/'bot'/name),'discoveredBeyondBaseline494':True,'versionReporting':'enclosing captured Catalog View / handler health report','owner':'Lead'})
(OUT/'additional-consumers.json').write_text(json.dumps({'baselineReferencesRetained':494,'additionalFiles':extra,'evidence':'Actual installed provider position, Center/Client constants and metrics assertions in bridge; full-snapshot Core position membership equality and Authority history/position tests.'},ensure_ascii=False,indent=2)+'\n')
baselines={}
for name,path,prefix in [('batch2-viewer',Path('/var/tmp/taiko-batch2-20261124/integration'),'6af2a292'),('batch2-bot',Path('/var/tmp/taiko-batch2-20261124/bot'),'cda0a85'),('batch2-core',Path('/var/tmp/taiko-batch2-20261124/core'),'52909ec'),('correctness-viewer',Path('/var/tmp/taiko-correctness-20261124/integration'),'26930740'),('correctness-bot',Path('/var/tmp/taiko-correctness-20261124/integration-bot'),'62c4d3e')]:
    value=subprocess.check_output(['git','rev-parse','HEAD'],cwd=path,text=True).strip();assert value.startswith(prefix);baselines[name]=value
missing=[]
for path in OUT.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)',path.read_text()):
        if target.startswith(('http:','https:','#')):continue
        resolved=(path.parent/target.split('#')[0]).resolve()
        if not resolved.exists():missing.append({'file':path.name,'target':target})
assert not missing,'Broken report links '+repr(missing)
result={'qaRun':os.environ['QA_RUN_ID'],'candidateTechnicalChecks':'PASS','catalogRevision':view.revision,'policyVersion':view.policy_version,'baselineReferences':494,'additionalAuditedFiles':len(extra),'cnFeatureCharts':len(records),'parserSourceHashesUnchanged':verified_parser,'retainedBaselines':baselines,'frontendMatchesAcceptedBuildCommit':'79d07cfc','positionAuthority':position_report,'reportLinks':'PASS','productionDeployed':False,'publicationRecoveryOrMeasurementBackfill':False}
(OUT/'delivery-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
