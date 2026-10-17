"""Synthetic policy checks; execute through memory/run_qa.sh."""
import importlib.util
import errno
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runtime_verifier', Path(__file__).with_name('verify-installed-runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class ProxyPolicyTests(unittest.TestCase):
    def test_disappearing_download_directory_is_ignored_only_for_enoent(self):
        def removed(root, *, onerror, followlinks):
            onerror(FileNotFoundError(errno.ENOENT, 'synthetic directory rotated'))
            return iter(())
        with patch.object(runtime.os, 'walk', removed):
            self.assertEqual(runtime.workspace_bytes(Path('/var/tmp/synthetic')), 0)
        def denied(root, *, onerror, followlinks):
            onerror(PermissionError(errno.EACCES, 'synthetic denied'))
            return iter(())
        with patch.object(runtime.os, 'walk', denied), self.assertRaises(PermissionError):
            runtime.workspace_bytes(Path('/var/tmp/synthetic'))

    def test_disappearing_download_file_is_ignored_but_io_failure_is_not(self):
        with patch.object(runtime.os, 'walk', return_value=iter([('/var/tmp/synthetic', [], ['partial'])])), \
             patch.object(runtime.os, 'lstat', side_effect=FileNotFoundError(errno.ENOENT, 'rotated')):
            self.assertEqual(runtime.workspace_bytes(Path('/var/tmp/synthetic')), 0)
        with patch.object(runtime.os, 'walk', return_value=iter([('/var/tmp/synthetic', [], ['partial'])])), \
             patch.object(runtime.os, 'lstat', side_effect=OSError(errno.EIO, 'synthetic IO failure')), \
             self.assertRaises(OSError):
            runtime.workspace_bytes(Path('/var/tmp/synthetic'))

    def test_progress_allows_download_beyond_old_240_second_limit(self):
        self.assertIsNone(runtime.download_stop_reason(10_000, 1000, 350, 300, 2, 600, 120))

    def test_idle_absolute_task_disk_and_log_limits_remain_independent(self):
        self.assertEqual(runtime.download_stop_reason(10, 10, 350, 300, 121, 600, 120), 'DOWNLOAD_IDLE_LIMIT')
        self.assertEqual(runtime.download_stop_reason(10, 10, 700, 601, 1, 600, 120), 'DOWNLOAD_TIME_LIMIT')
        self.assertEqual(runtime.download_stop_reason(10, 10, 781, 20, 1, 600, 120), 'DOWNLOAD_TASK_DEADLINE')
        self.assertEqual(runtime.download_stop_reason(1500 * 1024**2 + 1, 10, 1, 1, 1, 600, 120), 'DOWNLOAD_DISK_LIMIT')
        self.assertEqual(runtime.download_stop_reason(10, 1_000_001, 1, 1, 1, 600, 120), 'DOWNLOAD_LOG_LIMIT')

    def test_inheritance_is_explicit_and_allowlisted(self):
        with patch.dict(os.environ, {'HTTPS_PROXY': 'http://synthetic:credential@127.0.0.1:9', 'UNRELATED_SECRET': 'not-forwarded'}, clear=True):
            self.assertEqual(runtime.proxy_environment(), {})
            selected = runtime.proxy_environment(inherit=True)
            self.assertEqual(set(selected), {'HTTPS_PROXY'})

    def test_redaction_removes_urls_and_plain_or_encoded_credentials(self):
        redact = runtime.log_redactor({'HTTPS_PROXY': 'http://synthetic-user:secret%21@127.0.0.1:9'})
        output = redact('http://synthetic-user:secret%21@127.0.0.1:9 failed secret! secret%21 synthetic-user https://pypi.org/simple?a=b')
        for value in ('synthetic-user', 'secret!', 'secret%21', '://', 'pypi.org'):
            self.assertNotIn(value, output)

    def test_owned_private_proxy_file_and_rejected_permissions(self):
        with tempfile.TemporaryDirectory(prefix='runtime-proxy-policy-', dir='/var/tmp') as directory:
            path = Path(directory) / 'proxy.json'
            path.write_text(json.dumps({'HTTPS_PROXY': 'http://127.0.0.1:9'}))
            path.chmod(0o600)
            self.assertEqual(set(runtime.proxy_environment(env_file=path)), {'HTTPS_PROXY'})
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                runtime.proxy_environment(env_file=path)

    def test_no_symlink_unrelated_variable_or_embedded_newline(self):
        with tempfile.TemporaryDirectory(prefix='runtime-proxy-policy-', dir='/var/tmp') as directory:
            path = Path(directory) / 'proxy.json'
            for values in ({'PYTHONPATH': '/private'}, {'HTTPS_PROXY': 'http://localhost\nsecret'}):
                path.write_text(json.dumps(values))
                path.chmod(0o600)
                with self.assertRaises(ValueError):
                    runtime.proxy_environment(env_file=path)
            link = Path(directory) / 'link.json'
            link.symlink_to(path)
            with self.assertRaises(OSError):
                runtime.proxy_environment(env_file=link)

    def test_file_in_git_worktree_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='runtime-proxy-policy-', dir='/var/tmp') as directory:
            root = Path(directory)
            (root / '.git').mkdir()
            path = root / 'proxy.json'
            path.write_text('{}')
            path.chmod(0o600)
            with self.assertRaises(ValueError):
                runtime.proxy_environment(env_file=path)


if __name__ == '__main__':
    unittest.main()
