"""Cross-module aggregate validation; does not assert a preferred model outcome."""
import argparse
import hashlib
import json
from pathlib import Path
from run import PROTOCOL, _source_fingerprints


def verify(path):
    report=json.loads(path.read_text())
    assert report['schemaVersion']=='prediction-experiment-report/1'
    assert report['population']=='synthetic-only'
    assert report['protocol']==PROTOCOL
    assert report['sourceFingerprints']==_source_fingerprints(), 'report source drift'
    assert report['protocolHash']==hashlib.sha256(json.dumps(PROTOCOL,sort_keys=True).encode()).hexdigest()
    assert len(report['results'])==225 and len(report['splitAudits'])==9 and len(report['primary'])==3
    assert report['input']=={'rows':792,'deduplicatedRows':720,'duplicateSnapshotsRemoved':72,
        'personalAvailableRows':672,'personalInsufficientRows':48,'zeroHistoryRows':48}
    for audit in report['splitAudits']:
        assert not audit['violations'] and audit['heldOutUserOverlap']==0
        assert audit['trainRecords']>0 and audit['testRecords']>0
        assert audit['testPersonalAvailableRows']+audit['testPersonalInsufficientRows']==audit['testRecords']
    for split in PROTOCOL['splits']:
        rows=[r for r in report['results'] if r['split']==split]
        expected={(m,b,p) for m in PROTOCOL['matching'] for b in PROTOCOL['budgets'] for p in PROTOCOL['models']}
        assert {(r['matching'],r['budget'],r['model']) for r in rows}==expected
        assert len({(r['metrics']['records'],r['metrics']['distinctPlayers']) for r in rows})==1
        baselines=[r['metrics'] for r in rows if r['model']=='M0']
        assert all(r['userMacro']==baselines[0]['userMacro'] and r['recordWeighted']==baselines[0]['recordWeighted'] for r in baselines)
        for row in rows:
            cohort=row['cohort']
            assert cohort['meanEffectiveSampleSize']<=cohort['meanDistinctPlayers']+1e-7
            assert row['metrics']['distributionRecords']<=row['metrics']['records']
        if split!='cross-user':
            primary=[r for r in rows if r['matching']=='rating' and r['budget']=='top24']
            m0=next(r for r in primary if r['model']=='M0')
            for row in primary:
                assert row['metrics']['userMacro']==m0['metrics']['userMacro'], 'unseen-family fallback must include full personal distribution'
                assert row['cohort']['targetCohortCoverage']==0
    assert report['decision']['selectedModel']=='M0' and report['decision']['hybridRecommended'] is False
    text=path.read_text()
    assert 'synthetic-000' not in text and '"profileCharts"' not in text and '"predictions"' not in text
    print('PASS complete225-row matrix, source/target/evaluable identity, full fallback, aggregate-only report')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('report',type=Path)
    verify(parser.parse_args().report)
