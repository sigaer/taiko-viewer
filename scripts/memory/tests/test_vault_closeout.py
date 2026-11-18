import contextlib,io,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import vault_closeout as v

class VaultCloseoutTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'vault';self.root.mkdir()
        self.e=self.root/'runs/qa-0123456789ab/evidence';self.e.mkdir(parents=True)
        (self.root/'evidence').mkdir();self.out=Path(self.tmp.name)/'result';self.out.mkdir()
        self.plan=Path(self.tmp.name)/'plan.json'
        self.addCleanup(patch.stopall);patch.object(v,'VAULT',self.root).start()
        patch.object(v,'active',return_value=False).start()
        patch.object(v,'references',side_effect=lambda:v.c.process_refs(v.c.Budget(),root=self.root)).start()
        patch.dict(os.environ,{'QA_EVIDENCE_DIR':str(self.out)}).start()
    def quiet(self,fn):
        with contextlib.redirect_stdout(io.StringIO()):fn(self.plan)
    def test_finished_without_creator_metadata_and_source_retained(self):
        (self.e/'shot.png').write_bytes(b'fixture');(self.e/'source').mkdir();(self.e/'source/code.png').write_bytes(b'source')
        self.quiet(v.plan);self.quiet(v.apply)
        self.assertFalse((self.e/'shot.png').exists());self.assertTrue((self.e/'source/code.png').exists())
    def test_new_open_fd_retains_file(self):
        p=self.e/'shot.png';p.write_bytes(b'fixture');self.quiet(v.plan)
        with p.open('rb') as reader:self.quiet(v.apply);self.assertTrue(p.exists())
    def test_symlink_replacement_rejected(self):
        p=self.e/'shot.png';p.write_bytes(b'fixture');self.quiet(v.plan)
        outside=Path(self.tmp.name)/'outside';outside.write_bytes(b'keep');p.unlink();p.symlink_to(outside)
        with self.assertRaises(v.c.Unsafe):self.quiet(v.apply)
        self.assertEqual(outside.read_bytes(),b'keep')
    def test_nested_repository_is_not_generated_garbage(self):
        p=self.e/'.output';(p/'.git').mkdir(parents=True);(p/'app.js').write_text('source')
        self.quiet(v.plan);self.assertEqual(json.loads(self.plan.read_text())['items'],[])

if __name__=='__main__':unittest.main()
