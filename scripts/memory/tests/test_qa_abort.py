"""Only new abort-marker behavior; the existing 16 tests are not rerun."""
import importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('qa_vault',Path(__file__).parents[1]/'qa_vault.py');qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)
class AbortTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=os.environ['QA_RUN_TMPDIR']);self.base=Path(self.tmp.name);self.run=qa.Run(self.base/'vault')
 def tearDown(self):self.tmp.cleanup()
 def test_marker_overrides_successful_systemd_client_exit(self):
  child=subprocess.Popen(['/bin/true'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  qa.write_abort_marker(self.run,'RESOURCE_STOP')
  result=qa.supervise(child,self.run,lambda:True,100000,0,interval=.01,echo=False)
  self.assertEqual(result['exitCode'],125);self.assertEqual(result['processExitCode'],0);self.assertEqual(result['stopReason'],'OWNER_ABORT_RESOURCE_STOP')
 def test_wrong_identity_rejected(self):
  qa.write_abort_marker(self.run,'TEST');p=self.run.evidence/'abort.json';data=json.loads(p.read_text());data['runIdentity']=[0,0];p.write_text(json.dumps(data))
  with self.assertRaises(qa.UnsafePath):qa.read_abort_marker(self.run)
 def test_symlink_or_hardlink_rejected_without_touching_target(self):
  outside=self.base/'outside';outside.write_text('{}');outside.chmod(0o600);p=self.run.evidence/'abort.json';p.symlink_to(outside)
  with self.assertRaises((qa.UnsafePath,OSError)):qa.read_abort_marker(self.run)
  p.unlink();os.link(outside,p)
  with self.assertRaises(qa.UnsafePath):qa.read_abort_marker(self.run)
  self.assertEqual(outside.read_text(),'{}')
 def test_completed_outside_and_unstructured_reason_rejected(self):
  with self.assertRaises(qa.UnsafePath):qa.attach_active_run(self.base)
  with self.assertRaises(qa.UnsafePath):qa.write_abort_marker(self.run,'free text password=secret')
  self.run.atomic_json('manifest.json',{})
  with self.assertRaises(qa.UnsafePath):qa.write_abort_marker(self.run,'TEST')
 def test_marker_is_durable_before_stopping_exact_unit(self):
  def stop(unit):
   self.assertEqual(unit,'taiko-'+self.run.run_id);self.assertEqual(qa.read_abort_marker(self.run)['reason'],'TEST');return True
  with patch.object(qa,'attach_active_run',return_value=self.run),patch.object(qa,'stop_unit',side_effect=stop):self.assertTrue(qa.abort_run(self.run.path,'TEST'))
if __name__=='__main__':unittest.main()
