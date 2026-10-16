"""Targeted filesystem/termination tests; invoke inside the existing QA wrapper."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('qa_vault', Path(__file__).parents[1] / 'qa_vault.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

class VaultTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='qa-vault-test-', dir=os.environ.get('QA_RUN_TMPDIR', os.environ.get('TMPDIR')))
        self.base = Path(self.directory.name)
        self.run = qa.Run(self.base / 'vault')
    def tearDown(self):
        self.directory.cleanup()
    def launch(self, code, budget=100000, echo=False):
        child = subprocess.Popen([sys.executable, '-c', code, str(self.run.scratch), str(self.run.evidence)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
        def stop():
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            child.wait(timeout=5)
            return True
        return qa.supervise(child, self.run, stop, budget, 0, interval=0.02, timeout=5, echo=echo)
    def test_failure_keeps_log_and_manifest_cleans_only_owned_scratch(self):
        outside = self.base / 'external'; outside.write_text('keep')
        other = qa.Run(self.base / 'vault'); (other.scratch / 'keep').write_text('older')
        result = self.launch('import pathlib,sys; pathlib.Path(sys.argv[1],"scratch.txt").write_text("temporary"); print("failure evidence"); sys.exit(7)')
        self.assertEqual(result['exitCode'],7)
        self.assertTrue(result['childrenStopped'])
        self.assertEqual(self.run.clean_scratch(True),'REMOVED_OWNED_SCRATCH_ONLY')
        self.run.atomic_json('manifest.json',result)
        self.assertEqual(outside.read_text(),'keep')
        self.assertEqual((other.scratch/'keep').read_text(),'older')
        self.assertIn('failure evidence',(self.run.evidence/'output.log').read_text())
        self.assertFalse(self.run.scratch.exists())
        self.assertEqual(json.loads((self.run.evidence/'manifest.json').read_text())['exitCode'],7)
    def test_scratch_overflow_stops_process_and_preserves_failure(self):
        result=self.launch('import pathlib,sys,time; pathlib.Path(sys.argv[1],"large").write_bytes(b"x"*20000); time.sleep(5)',budget=10000)
        self.assertEqual(result['stopReason'],'SCRATCH_LIMIT')
        self.assertTrue(result['childrenStopped'])
        self.assertGreater(result['samples'][-1]['scratch']['bytes'],10000)
        self.run.clean_scratch(True)
        self.assertTrue((self.run.evidence/'output.log').exists())
    def test_low_water_and_per_file_bound(self):
        record=qa.sample(self.run,'before')
        self.assertEqual(qa.violation(record,1000,record['freeBytes']+1),'DISK_LOW_WATER')
        record['run']['largestFileBytes']=2*qa.GIB+1
        self.assertEqual(qa.violation(record,100000,0),'FILE_LIMIT')
    def test_scratch_symlink_counted_without_traversing_external_target(self):
        outside=self.base/'outside'; outside.mkdir(); (outside/'keep').write_text('safe')
        (self.run.scratch/'escape').symlink_to(outside,target_is_directory=True)
        sample=qa.sample(self.run,'during')
        self.assertEqual(sample['scratch']['symlinkCount'],1)
        self.assertEqual(sample['scratch']['entries'],1)
        self.run.clean_scratch(True)
        self.assertEqual((outside/'keep').read_text(),'safe')
    def test_swapped_scratch_rejected_for_cleanup(self):
        original=self.run.scratch.with_name('original-scratch'); self.run.scratch.rename(original)
        outside=self.base/'outside'; outside.mkdir(); (outside/'keep').write_text('safe')
        self.run.scratch.symlink_to(outside,target_is_directory=True)
        with self.assertRaises(qa.UnsafePath): self.run.clean_scratch(True)
        self.assertEqual((outside/'keep').read_text(),'safe')
        self.assertTrue(original.exists())
    def test_unproven_child_exit_retains_scratch(self):
        (self.run.scratch/'keep').write_text('pending')
        self.assertEqual(self.run.clean_scratch(False),'RETAINED_CHILD_EXIT_UNPROVEN')
        self.assertTrue(self.run.scratch.exists())
    def test_atomic_manifest_refuses_symlink_destination(self):
        outside=self.base/'outside'; outside.write_text('safe')
        (self.run.evidence/'manifest.json').symlink_to(outside)
        with self.assertRaises(qa.UnsafePath): self.run.atomic_json('manifest.json',{'safe':True})
        self.assertEqual(outside.read_text(),'safe')
    def test_evidence_symlink_rejected(self):
        outside=self.base/'outside'; outside.write_text('safe')
        (self.run.evidence/'escape').symlink_to(outside)
        with self.assertRaises(qa.UnsafePath): qa.sample(self.run,'during')
        self.assertEqual(outside.read_text(),'safe')
    def test_allocated_and_logical_bytes_are_distinct(self):
        with (self.run.scratch/'sparse').open('wb') as stream: stream.truncate(1024*1024)
        result=qa.tree_usage(self.run.scratch)
        self.assertEqual(result['logicalBytes'],1024*1024)
        self.assertLess(result['allocatedBytes'],result['logicalBytes'])
    def test_archive_hashes_evidence_and_rejects_links(self):
        (self.run.evidence/'result.json').write_text('{}')
        records=qa.archive_evidence(self.run)
        self.assertEqual(records[0]['path'],'result.json')
        self.assertEqual(records[0]['bytes'],2)
        self.assertEqual(records[0]['sha256'],qa.hashlib.sha256(b'{}').hexdigest())
        (self.run.evidence/'escape').symlink_to(self.base)
        with self.assertRaises(qa.UnsafePath): qa.archive_evidence(self.run)
    def test_vault_root_symlink_rejected(self):
        (self.base/'link').symlink_to(self.run.root,target_is_directory=True)
        with self.assertRaises(qa.UnsafePath): qa.Run(self.base/'link')
    def test_hardlink_rejected(self):
        outside=self.base/'outside'; outside.write_text('safe')
        os.link(outside,self.run.scratch/'link')
        with self.assertRaises(qa.UnsafePath): qa.sample(self.run,'during')
        self.run.clean_scratch(True)
        self.assertEqual(outside.read_text(),'safe')
    def test_budget_output_and_directory_modes(self):
        for path in [self.run.root,self.run.path,self.run.scratch,self.run.evidence]: self.assertEqual(path.stat().st_mode & 0o777,0o700)
        result=self.launch('print("hello")')
        self.assertEqual(result['exitCode'],0)
        self.assertEqual(result['log']['bytes'],6)
        self.assertEqual((self.run.evidence/'output.log').stat().st_mode & 0o777,0o600)
    def test_systemd_budgets_preserved_env_is_owned_and_no_secret_manifest(self):
        with patch.dict(os.environ,{'QA_RUN_DIR':'/external','QA_RUN_TMPDIR':'/external','QA_ARTIFACT_MANIFEST':str(self.run.root/'artifacts/runtime-manifest.json')}):
            command=qa.systemd_command('test-unit',self.run,['/bin/true','secret-not-logged'])
        self.assertIn('--setenv=QA_RUN_TMPDIR='+str(self.run.scratch),command)
        self.assertIn('RuntimeMaxSec=15min',command); self.assertIn('MemoryMax=3G',command)
        self.assertIn('LimitFSIZE=2147483648',command)
        self.assertLess(len(str(qa.DEFAULT_ROOT/'runs/qa-123456789abc/scratch/m.sock').encode()),104)
    def test_artifact_manifest_rejects_outside_and_symlink(self):
        with patch.dict(os.environ,{'QA_ARTIFACT_MANIFEST':str(self.base/'outside')}):
            with self.assertRaises(qa.UnsafePath): qa.artifact_manifest(self.run)
        (self.run.root/'escape').symlink_to(self.base)
        with patch.dict(os.environ,{'QA_ARTIFACT_MANIFEST':str(self.run.root/'escape/manifest.json')}):
            with self.assertRaises(qa.UnsafePath): qa.artifact_manifest(self.run)

if __name__=='__main__': unittest.main()
