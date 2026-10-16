#!/usr/bin/env python3
"""Derive a local lock for authorized source-verified rebuilds; originals stay immutable."""
import argparse, hashlib, json, shutil, time
from pathlib import Path

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('vault','lock','catalog','taiko-evidence','memory-evidence'):p.add_argument('--'+name,type=Path,required=True)
    a=p.parse_args();vault=a.vault.resolve()
    if not vault.is_dir() or vault.stat().st_mode&0o077 or str(vault).startswith(('/tmp/','/var/tmp/')):p.error('private persistent vault required')
    original=sha(a.lock);lock=json.loads(a.lock.read_text());catalog=json.loads(a.catalog.read_text());changes=[]
    t=json.loads(a.taiko_evidence.read_text());m=json.loads(a.memory_evidence.read_text())
    if t['sourceCommit']!='a632913dfbdbec1d465f8eaccc0bb80c35e25745' or t['sourceMismatches'] or t['status'] not in ('PASS_EXACT_WHEEL','SOURCE_PARITY_OLD_ARCHIVE_BYTES_UNAVAILABLE'):raise RuntimeError('Taiko source proof missing')
    if m['sourceCommit']!='63be19a5c35ba98831b3eeec1746f36fed049a7e' or not m['sourceByteParity'] or m['status'] not in ('PASS_EXACT_REBUILD','REBUILT_HASH_DIFF_SOURCE_PARITY'):raise RuntimeError('shared source proof missing')
    replacements={'taiko-bot':t['wheel'],'python-memory-runtime':m['wheel']}
    target=vault/('locks-'+str(time.time_ns()));target.mkdir(mode=0o700)
    for role,definition in lock['roles'].items():
        old_req=a.lock.parent/definition['requirements'];text=old_req.read_text()
        if sha(old_req)!=definition['requirementsSha256']:raise RuntimeError('original requirements changed')
        for wheel in definition['wheels']:
            if wheel['name'] in replacements:
                new=replacements[wheel['name']];file=Path(new['file']).resolve()
                if not file.is_relative_to(vault) or sha(file)!=new['sha256']:raise RuntimeError('unverified rebuilt wheel')
                old=wheel['sha256'];text=text.replace('--hash=sha256:'+old,'--hash=sha256:'+new['sha256'])
                changes.append({'role':role,'name':wheel['name'],'oldSha256':old,'newSha256':new['sha256']})
                wheel.update(file=str(file),sha256=new['sha256'])
                catalog['artifacts'][new['sha256']]={**wheel,'bytes':file.stat().st_size}
        req=target/(role+'.requirements.txt');req.write_text(text)
        definition.update(requirements=req.name,requirementsSha256=sha(req),environmentIdentity='sha256:'+sha(req),qaInterpreter=None,rebuildEvidence=None)
    lock.update(parentManifest=str(a.lock.resolve()),parentManifestSha256=original,scope='Authorized locked-source local rebuild; historical archive content equivalence is not claimed.')
    lockfile=target/'runtime-role-locks.json';lockfile.write_text(json.dumps(lock,indent=2)+'\n')
    for definition in lock['roles'].values():
        for wheel in definition['wheels']:
            item=catalog['artifacts'].get(wheel['sha256'])
            if not item or sha(Path(item['file']))!=wheel['sha256']:raise RuntimeError('derived artifact set incomplete')
    catalog.update(status='PASS_LOCKED_DEPENDENCIES_WITH_LOCAL_REBUILDS',missing=[],lockFile=str(lockfile),lockSha256=sha(lockfile))
    catalogfile=target/'artifact-catalog.json';catalogfile.write_text(json.dumps(catalog,indent=2)+'\n')
    proof={'status':'PASS_LOCKED_SOURCE_REBUILD','historicalContentParityClaim':False,'archiveDifferenceCause':'UNDETERMINED_OLD_ARCHIVE_UNAVAILABLE','originalLockFile':str(a.lock.resolve()),'originalLockSha256':original,'derivedLockFile':str(lockfile),'derivedLockSha256':sha(lockfile),'originalWheelSha256':next(x['oldSha256'] for x in changes if x['name']=='taiko-bot'),'candidateWheelSha256':t['wheel']['sha256'],'thirdPartyWheelsUnchanged':True,'changes':changes,'sourceEvidence':[{'file':str(e.resolve()),'sha256':sha(e)} for e in (a.taiko_evidence,a.memory_evidence)]}
    (target/'derivation-evidence.json').write_text(json.dumps(proof,indent=2)+'\n')
    if sha(a.lock)!=original:raise RuntimeError('original lock changed')
    print(json.dumps({'lock':str(lockfile),'catalog':str(catalogfile),'derivationEvidence':str(target/'derivation-evidence.json')}))
if __name__=='__main__':main()
