"""B4 final-review bounded archival and scope audit; invoke through memory/run_qa.sh."""
import hashlib, json, pathlib, re, shutil, subprocess, sys
root = pathlib.Path(sys.argv[1]).resolve()
out = root / 'docs/batch4/implementation/evidence/immutable-baseline'
base = '35ff18c4568e32719b14678a5f5ee0288fa32340'
def git(*args): return subprocess.check_output(['git', *args], cwd=root)
def sha(data): return hashlib.sha256(data).hexdigest()
protected = ['docs/batch3', 'taiko_viewer/utils/playerGoal.ts', 'taiko_viewer/utils/goalEvaluation.ts',
             'taiko_viewer/utils/multi-objective/actionability.ts', 'taiko_viewer/utils/multi-objective/evidence.ts',
             'taiko_viewer/utils/player-intelligence', 'taiko_viewer/types', 'packages', 'taiko_viewer/server',
             'taiko_viewer/pages', 'taiko_viewer/components', 'scripts', 'docs/batch4/implementation/evidence',
             'docs/batch4/implementation/performance-benchmark.md', 'docs/batch4/implementation/review-fix-performance.md']
old = set(git('ls-tree', '-r', '--name-only', base, '--', *protected).decode().splitlines())
diff = set(git('diff', '--name-only', base).decode().splitlines())
assert not old.intersection(diff), sorted(old.intersection(diff))
# Preserve all prior test assertions except the explicitly corrected baseline creation/scope setup.
test_diff = set(git('diff', '--name-only', base, '--', 'taiko_viewer/tests').decode().splitlines())
allowed_tests = {'taiko_viewer/tests/multi-objective/fixtures.ts', 'taiko_viewer/tests/multi-objective/evidence-scope-baseline.test.ts', 'taiko_viewer/tests/multi-objective/immutable-baseline.test.ts'}
assert test_diff <= allowed_tests, sorted(test_diff)
expected = {'existing-baseline.json': 'ed6ed2b0f0bfce8ef197536a0e81f32a9115d133b235f5dd69d8e3b02b53f36f',
            'offline-benchmark.json': 'acf208e6efb5a62b44e9b4a33f526c52e7cab03574c02400d114b90337e57bbc'}
for name, h in expected.items(): assert sha((root/'docs/batch3/evidence'/name).read_bytes()) == h
runs = []
for run, purpose, exit_code in [('qa-04669f4930b9', 'Original 270 B4 tests and strict TS', 0),
 ('qa-bd5ee7aee3cb', 'New test narrowing errors, subsequently corrected', 2),
 ('qa-3e51de7198a1', 'New negative fixture produced target mismatch; corrected to test wrong evidence under same target', 1),
 ('qa-c6449d449829', '299 B4 tests including 29 new regressions; strict TS', 0),
 ('qa-b31d9d2a8f5f', 'Final 299 B4 + 92 B3 Node, both strict TS checks and original B3 report hashes', 0)]:
    path = pathlib.Path('/home/sigaer/taiko/qa-vault/runs')/run/'evidence'
    m=json.loads((path/'manifest.json').read_text()); data=(path/'output.log').read_bytes()
    assert m['exitCode']==m['processExitCode']==exit_code and m['childrenStopped'] and m['stopReason'] is None
    assert sha(data)==m['log']['sha256']
    if run=='qa-b31d9d2a8f5f':
        for text in ['tests 299', 'pass 299', 'tests 92', 'pass 92', 'existing-baseline.json: OK', 'offline-benchmark.json: OK']: assert text in data.decode()
    shutil.copyfile(path/'manifest.json', out/(run+'.manifest.json')); shutil.copyfile(path/'output.log',out/(run+'.output.txt'))
    runs.append({'runId':run,'purpose':purpose,'exitCode':exit_code,'childrenStopped':True,'outputSha256':sha(data)})
links=0
for doc in (root/'docs/batch4/implementation').glob('*.md'):
    text=doc.read_text(); assert text.count('```')%2==0,doc
    for link in re.findall(r'\]\(([^)]+)\)',text):
        if re.match(r'^[a-z]+:',link) or link.startswith('#'): continue
        assert (doc.parent/link.split('#')[0]).exists(),(doc.name,link)
        links+=1
kernel={str(p.relative_to(root)):sha(p.read_bytes()) for p in sorted((root/'taiko_viewer/utils/multi-objective').glob('*.ts'))}
report={'schemaVersion':'b4-immutable-baseline-review/1','baseCommit':base,'b4Tests':299,'newTests':29,'b3NodeTests':92,
 'strictTypeScript':'PASS','crownActionabilityByteIdentical':True,'originalB3ReportSha256':expected,'protectedPathChanges':[],
 'coreReplay':{'status':'BLOCKED_MISSING_ORIGINAL_DEPENDENCY','requiredVersion':'0.1.4rc2',
 'missingPaths':['/var/tmp/taiko-batch21-20261124/installed-rc9/bin/python','/var/tmp/taiko-batch21-20261124/core/tests'],
 'availableCoreCommit':'0b7319d94b041daafb0a0d32e3ccc95e50da8810','availableCoreVersion':'0.1.2',
 'substitutionUsed':False,'goldenFixtureSha256':'e9ef77baf564e599f167f639c8a7805c8f79f6fccf95a16c6494e26b064690a9',
 'targetFixtureSha256':'6db08d5cefd25311c564d18e40d76e7ccba48f4fbf1188409d24f793289eed79',
 'sourceFilesDifferFromOriginal':['chart/availability.py','chart/position.py','chart/progress_catalog.py','chart/visibility.py','parser/chart_analysis.py','parser/tja.py','recommendation/candidates.py','recommendation/catalog_inputs.py','recommendation/client_selection.py','recommendation/support.py'],
 'sourceFilesMissing':['score/time.py']},'kernelFileHashes':kernel,'runs':runs,'validLinks':links}
(out/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
subprocess.run(['git','diff','--check'],cwd=root,check=True)
print(json.dumps({'boundary':'PASS','b4Tests':299,'b3NodeTests':92,'strictTypeScript':'PASS','originalReports':'UNCHANGED','crownActionability':'BYTE_IDENTICAL','coreReplay':'BLOCKED_MISSING_0.1.4rc2','archivedRuns':len(runs)}))
