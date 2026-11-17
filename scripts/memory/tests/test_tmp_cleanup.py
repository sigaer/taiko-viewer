"""Deletion boundaries, active consumers, age and races for scheduled cleanup."""
import importlib.util
import fcntl
import io
import json
from contextlib import redirect_stdout
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('tmp_cleanup', Path(__file__).parents[1] / 'tmp_cleanup.py')
clean = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clean)


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ['QA_RUN_TMPDIR'])
        self.root = Path(self.tmp.name)
        self.now = time.time() + 40 * clean.DAY

    def tearDown(self):
        self.tmp.cleanup()

    def artifact(self, suffix='taiko-old/web/.output'):
        path = self.root / suffix
        path.mkdir(parents=True)
        (path / 'compiled.js').write_text('fixture')
        return path

    def selected(self, protected=()):
        return clean.candidates(self.root, self.now, clean.Budget(), protected)

    def test_only_generated_trees_selected_and_source_preserved(self):
        artifact = self.artifact()
        source = artifact.parent / 'page.vue'
        source.write_text('source')
        items = self.selected()
        self.assertEqual([i['path'] for i in items], [str(artifact)])
        clean.remove(items[0], self.root, self.now, clean.Budget(), set(), ())
        self.assertTrue(source.is_file())
        self.assertFalse(artifact.exists())

    def test_nested_recent_file_retains_old_directory(self):
        artifact = self.artifact()
        os.utime(artifact / 'compiled.js', (self.now, self.now))
        self.assertEqual(self.selected(), [])

    def test_persistent_database_and_unknown_roots_never_selected(self):
        staging = self.artifact('taiko-viewer-ourtaiko-staging/web/.output')
        self.artifact('other-project/web/.output')
        data = self.artifact('taiko-old/mysql/.output')
        self.assertEqual(self.selected((staging.parents[1],)), [])
        self.assertTrue(data.exists())

    def test_symlink_generated_root_never_followed(self):
        outside = self.root / 'outside'
        outside.mkdir()
        web = self.root / 'viewer-old/web'
        web.mkdir(parents=True)
        (web / 'node_modules').symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.selected(), [])
        self.assertTrue(outside.exists())

    def test_open_file_and_process_argument_protect_tree(self):
        artifact = self.artifact()
        proc = self.root / 'proc/101'
        (proc / 'fd').mkdir(parents=True)
        (proc / 'cmdline').write_bytes(str(artifact / 'compiled.js').encode() + b'\0')
        (proc / 'environ').write_bytes(b'')
        (proc / 'maps').write_text('')
        (proc / 'fd/7').symlink_to(artifact / 'compiled.js')
        refs = clean.process_refs(clean.Budget(), proc_root=proc.parent, root=self.root)
        self.assertTrue(clean.referenced(artifact, refs))
        self.assertFalse(clean.referenced(self.root / 'taiko-other', refs))
        with self.assertRaises(clean.Unsafe):
            clean.remove(self.selected()[0], self.root, self.now, clean.Budget(), refs, ())
        self.assertTrue(artifact.exists())

    def test_parent_service_reference_and_retained_symlink_protect_subtree(self):
        artifact = self.artifact()
        self.assertTrue(clean.referenced(artifact, {artifact.parents[1]}))
        link = self.root / 'live-link'
        link.symlink_to(artifact)
        self.assertTrue(clean.referenced(artifact, {link.resolve()}))

    def test_new_content_after_discovery_blocks_delete(self):
        artifact = self.artifact()
        item = self.selected()[0]
        (artifact / 'new').write_text('new')
        with self.assertRaises(clean.Unsafe):
            clean.remove(item, self.root, self.now, clean.Budget(), set(), ())
        self.assertTrue(artifact.exists())

    def test_streamed_source_scan_retains_file_and_directory_link_targets(self):
        artifact = self.artifact()
        source = self.root / 'retained-source'
        source.mkdir()
        (source / 'file-link').symlink_to(artifact / 'compiled.js')
        (source / 'directory-link').symlink_to(artifact)
        refs = clean.symlink_refs(clean.Budget(), (source,), self.root)
        self.assertIn(artifact, refs)
        self.assertIn(artifact / 'compiled.js', refs)
        self.assertTrue(clean.referenced(artifact, refs))

    def test_regular_sources_require_no_per_file_metadata_probe(self):
        source = self.root / 'source'
        source.mkdir()
        for number in range(1000):
            (source / f'file-{number}.vue').write_text('source')
        budget = clean.Budget(max_entries=2)
        self.assertEqual(clean.symlink_refs(budget, (source,), self.root), set())
        self.assertEqual(budget.entries, 1)

    def test_symlink_scan_deadline_is_enforced(self):
        self.artifact()
        with self.assertRaises(clean.Unsafe):
            clean.symlink_refs(clean.Budget(seconds=0), (self.root,), self.root)

    def test_replaced_inode_or_symlink_blocks_delete(self):
        artifact = self.artifact()
        item = self.selected()[0]
        renamed = artifact.with_name('retained-original')
        artifact.rename(renamed)
        artifact.mkdir()
        with self.assertRaises(clean.Unsafe):
            clean.remove(item, self.root, self.now, clean.Budget(), set(), ())
        artifact.rmdir()
        artifact.symlink_to(renamed)
        with self.assertRaises(clean.Unsafe):
            clean.remove(item, self.root, self.now, clean.Budget(), set(), ())
        self.assertTrue((renamed / 'compiled.js').exists())

    def test_discovery_budget_is_fail_closed(self):
        self.artifact()
        with self.assertRaises(clean.Unsafe):
            clean.candidates(self.root, self.now, clean.Budget(max_entries=1), ())

    def test_loose_logs_thirty_days_but_never_source_or_secret_files(self):
        log = self.root / 'viewer-old.log'
        log.write_text('old')
        for name in ['viewer-source.py', 'viewer-private.env', 'unowned.log']:
            (self.root / name).write_text('retain')
        items = self.selected()
        self.assertEqual([i['path'] for i in items], [str(log)])
        self.assertEqual(clean.candidates(self.root, time.time() + 10 * clean.DAY, clean.Budget(), ()), [])

    def test_build_cache_names_and_seven_day_retention(self):
        good = self.root / 'taiko-build' / ('a' * 32)
        good.mkdir(parents=True)
        (good / 'sw.js').write_text('generated')
        other = good.parent / 'source-backup'
        other.mkdir()
        self.assertEqual([i['path'] for i in self.selected()], [str(good)])
        self.assertEqual(clean.candidates(self.root, time.time() + 6 * clean.DAY, clean.Budget(), ()), [])

    def test_busy_maintenance_lock_skips_without_discovery_or_deletion(self):
        lock = self.root / 'lock'
        with lock.open('a') as owner:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(clean, 'LOCK', lock), patch.object(clean, 'run') as run, patch('sys.argv', ['cleanup', '--apply']), redirect_stdout(io.StringIO()) as output:
                self.assertEqual(clean.main(), 0)
                self.assertEqual(json.loads(output.getvalue())['status'], 'SKIPPED')
                run.assert_not_called()

    def test_incomplete_scan_reports_failure_without_mutation(self):
        with patch.object(clean, 'LOCK', self.root / 'lock'), patch.object(clean, 'run', side_effect=clean.Unsafe('budget')), patch.object(clean, 'save_report') as save, patch('sys.argv', ['cleanup', '--apply']), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(clean.main(), 1)
            self.assertEqual(json.loads(output.getvalue())['status'], 'FAILED')
            self.assertEqual(save.call_args.args[0]['removed'], [])

    def test_cli_root_cannot_be_redirected_outside_var_tmp(self):
        with self.assertRaises(clean.Unsafe):
            clean.run(self.root, apply=True)

    def test_new_service_reference_skips_only_its_directory(self):
        artifact = self.artifact()
        items = self.selected()
        items[0]['ageSeconds'] = 0
        with patch.object(clean, 'ROOT', self.root), patch.object(clean, 'candidates', return_value=[]), patch.object(clean, 'managed_candidates', return_value=items), patch.object(clean, 'process_refs', return_value=set()), patch.object(clean, 'retained_refs', side_effect=[set(), {artifact}]):
            result = clean.run(self.root, apply=True, protected=())
        self.assertEqual(result['removed'], [])
        self.assertEqual(result['retainedByReference'], 1)
        self.assertTrue(artifact.exists())

    def test_late_budget_failure_preserves_completed_deletion_record(self):
        first = self.artifact()
        second = self.artifact('taiko-other/web/.output')
        items = self.selected()
        for item in items: item['ageSeconds'] = 0
        with patch.object(clean, 'ROOT', self.root), patch.object(clean, 'candidates', return_value=[]), patch.object(clean, 'managed_candidates', return_value=items), patch.object(clean, 'process_refs', side_effect=[set(), set(), clean.Unsafe('budget')]), patch.object(clean, 'retained_refs', return_value=set()):
            result = clean.run(self.root, apply=True, protected=())
        self.assertEqual(result['status'], 'FAILED')
        self.assertEqual(len(result['removed']), 1)
        self.assertGreater(result['allocatedBytesRemoved'], 0)
        self.assertEqual(sum(p.exists() for p in [first,second]), 1)

    def test_disappeared_reference_root_skips_but_permission_error_fails(self):
        self.assertEqual(clean.symlink_refs(clean.Budget(),(self.root/'gone',),self.root),set())
        with patch.object(clean.os,'scandir',side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError):clean.symlink_refs(clean.Budget(),(self.root,),self.root)

    def test_internal_scratch_links_do_not_pin_their_own_task(self):
        task=self.root/'viewer-task';task.mkdir();(task/'internal').symlink_to(task/'data')
        outside=self.root/'consumer';outside.mkdir();(outside/'external').symlink_to(task/'data')
        refs=clean.symlink_refs(clean.Budget(),(self.root,),self.root,excluded=(task,))
        self.assertIn(task/'data',refs)
        (outside/'external').unlink()
        self.assertEqual(clean.symlink_refs(clean.Budget(),(self.root,),self.root,excluded=(task,)),set())


if __name__ == '__main__':
    unittest.main()
