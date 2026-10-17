#!/usr/bin/env python3
"""Write a persistent manifest only from verified exact installed-role evidence."""
import argparse, hashlib, json
from pathlib import Path

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--vault',type=Path,required=True)
    p.add_argument('--lock',type=Path,required=True)
    p.add_argument('--catalog',type=Path,required=True)
    p.add_argument('--center-evidence',type=Path,required=True)
    p.add_argument('--client-evidence',type=Path,required=True)
    p.add_argument('--publication-repo-root',type=Path,required=True)
    p.add_argument('--assets-root',type=Path)
    p.add_argument('--derivation-evidence',type=Path)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();vault=a.vault.resolve();lock=json.loads(a.lock.read_text());catalog=json.loads(a.catalog.read_text())['artifacts'];roles={}
    if a.output.exists():p.error('manifest exists')
    publication=a.publication_repo_root.resolve()
    if not publication.is_relative_to(vault) or not publication.is_dir() or any(publication.iterdir()):p.error('publication fallback must be an empty persistent vault directory')
    for role,evidence in [('center',a.center_evidence),('client',a.client_evidence)]:
        e=json.loads(evidence.read_text())
        if e['status']!='PASS_EXACT_OFFLINE_ROLE_REBUILD' or e['lockManifestSha256']!=sha(a.lock):raise RuntimeError('unverified installed role')
        wheel=next(w for w in lock['roles'][role]['wheels'] if w['name']=='taiko-bot')
        file=Path(catalog[wheel['sha256']]['file']).resolve();python=Path(e['installed']['interpreter'])
        if sha(file)!=wheel['sha256']:raise RuntimeError('wheel changed')
        for path in (evidence.resolve(),file,python.absolute(),a.lock.resolve()):
            if not path.is_relative_to(vault):raise RuntimeError('artifact outside persistent vault')
        roles[role]={'python':str(python),'pythonSha256':sha(python),'wheelFile':str(file),'wheelSha256':sha(file),'lockFile':str(a.lock.resolve()),'lockSha256':sha(a.lock),'originEvidenceFile':str(evidence.resolve()),'originEvidenceSha256':sha(evidence),'provenanceStatus':'EXACT_ORIGINAL'}
    if a.derivation_evidence:
        proof=json.loads(a.derivation_evidence.read_text())
        if proof['status']!='PASS_LOCKED_SOURCE_REBUILD' or not proof['thirdPartyWheelsUnchanged'] or proof['derivedLockSha256']!=sha(a.lock):raise RuntimeError('invalid derivation evidence')
        for value in roles.values():
            if value['wheelSha256']!=proof['candidateWheelSha256']:raise RuntimeError('derivation wheel mismatch')
            value.update(provenanceStatus='LOCKED_SOURCE_REBUILD_DERIVED_LOCK',derivationEvidenceFile=str(a.derivation_evidence.resolve()),derivationEvidenceSha256=sha(a.derivation_evidence))
    result={'schemaVersion':1,'candidate':roles['center'],'roles':roles,'baseline':None,'baselineStatus':'MISSING_0_14_1_INSTALLED_EVIDENCE','publicationRepoRoot':str(publication),'publicationRepoRootPolicy':'OVERRIDE_WITH_PER_RUN_QA_RUN_TMPDIR','assetsRoot':str(a.assets_root.resolve()) if a.assets_root else None,'assetsStatus':'AVAILABLE' if a.assets_root else 'MISSING','productionAccess':False}
    a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'manifest':str(a.output),'sha256':sha(a.output)}))
if __name__=='__main__':main()
