"""Release scratch lifecycle only; never invokes deployment or a service."""
import json,os,shutil,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]))
import release_scratch as r
import qa_vault as q
class ReleaseScratchTests(unittest.TestCase):
    def test_runner_delegates_deletion_until_all_children_exit(self):
        root=r.create(os.getpid())
        try:
            self.assertEqual(root,Path(os.environ['QA_RUN_TMPDIR'])/'release')
            self.assertEqual(r.cleanup(root,os.getpid()),'DEFERRED_TO_OWNING_RUNNER')
            self.assertTrue(root.exists())
        finally:shutil.rmtree(root)
    def test_direct_owner_archives_and_cleans_without_service_actions(self):
        with tempfile.TemporaryDirectory(dir=os.environ['QA_RUN_TMPDIR']) as tmp,patch.object(q,'DEFAULT_ROOT',Path(tmp)/'vault'),patch.dict(os.environ,{'QA_RUN_TMPDIR':''}):
            root=r.create(os.getpid());(root/'build.log').write_text('synthetic build evidence')
            self.assertEqual(r.cleanup(root,os.getpid()),'REMOVED_OWNED_SCRATCH_ONLY')
            self.assertFalse(root.exists())
            self.assertEqual(next((Path(tmp)/'vault/runs').glob('*/evidence/build-tail.log')).read_text(),'synthetic build evidence')
    def test_direct_open_fd_retains_then_releases(self):
        with tempfile.TemporaryDirectory(dir=os.environ['QA_RUN_TMPDIR']) as tmp,patch.object(q,'DEFAULT_ROOT',Path(tmp)/'vault'),patch.dict(os.environ,{'QA_RUN_TMPDIR':''}):
            root=r.create(os.getpid());file=root/'open.txt';file.write_text('fixture')
            with file.open() as hold:
                self.assertEqual(r.cleanup(root,os.getpid()),'RETAINED_EXTERNAL_REFERENCE')
                self.assertTrue(root.exists())
            self.assertEqual(r.cleanup(root,os.getpid()),'REMOVED_OWNED_SCRATCH_ONLY')
    def test_foreign_directory_is_never_removed(self):
        with tempfile.TemporaryDirectory(dir=os.environ['QA_RUN_TMPDIR']) as tmp:
            with self.assertRaises(q.UnsafePath):r.cleanup(tmp,os.getpid())
            self.assertTrue(Path(tmp).exists())
if __name__=='__main__':unittest.main()
