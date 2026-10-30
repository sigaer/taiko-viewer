#!/usr/bin/env python3
"""Offline boundary tests: synthetic credentials/responses; no network."""
import contextlib
import ast
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import unittest

sys.dont_write_bytecode = True
socket.socket.connect = lambda *_: (_ for _ in ()).throw(AssertionError('NETWORK_FORBIDDEN'))
spec = importlib.util.spec_from_file_location('u1', Path(__file__).with_name('source_u1_readonly.py'))
u1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u1)
IDENTITY = '990000000000000001'
SECRET = 'synthetic-private-credential-must-never-appear'


def payloads():
    return [
        {'data': {'playedRecords': {'scoreInfo': [], 'pagination':
                 {'page': 1, 'pageSize': 3000, 'total': 0, 'hasNext': False}}}},
        {'data': {'players': [{'userid': '990000000000000002'}, {'userid': IDENTITY}]}},
        {'data': {'userid': IDENTITY}}, {'data': {}},
    ]


class Response:
    def __init__(self, value, status=200, raw=None, headers=None, advance=None):
        self.body = json.dumps(value).encode() if raw is None else raw
        self.raw = self
        self.stream = io.BytesIO(self.body)
        self.status_code = status
        self.headers = headers if headers is not None else {'Content-Length': str(len(self.body))}
        self.closed = False
        self.advance = advance

    def read(self, n, decode_content=False):
        if self.advance:
            self.advance()
        return self.stream.read(n)

    def close(self):
        self.closed = True


class Sink:
    def __init__(self): self.opens = 0; self.summary = None
    def open_response(self, index):
        self.opens += 1
        # A bounded real scratch file tests flush/fsync without retaining bytes.
        return open(ROOT / f'response-{self.opens}', 'w+b')
    def save_summary(self, summary): self.summary = summary


class Session:
    def __init__(self, responses):
        self.responses = list(responses); self.calls = []; self.closed = False
        self.headers = {'Authorization': SECRET}; self.cookies = type('Cookies', (), {'clear': lambda _: None})()
    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        value = self.responses[len(self.calls) - 1]
        if isinstance(value, Exception): raise value
        return value
    def close(self): self.closed = True


class BoundaryTests(unittest.TestCase):
    def run_case(self, responses=None, clock=None):
        session = Session(responses or [Response(v) for v in payloads()]); sink = Sink()
        result = u1.collect(IDENTITY, lambda: SECRET, lambda _: session, lambda: sink,
                            authorized=True, **({'clock': clock} if clock else {}))
        self.assertTrue(session.closed)
        self.assertNotIn(SECRET, json.dumps(result))
        return result, session, sink

    def test_no_authorization_has_no_credential_network_or_evidence_effects(self):
        def forbidden(*_): self.fail('UNAUTHORIZED_SIDE_EFFECT')
        with self.assertRaisesRegex(u1.U1Stop, 'BLOCKED_PENDING'):
            u1.collect(IDENTITY, forbidden, forbidden, forbidden)

    def test_plan_refuses_before_case_or_cookie_read(self):
        with self.assertRaisesRegex(u1.U1Stop, 'BLOCKED_PENDING'):
            u1.authorize_plan({'authorizationStatus': 'NOT_GRANTED'})

    def test_plan_cli_cannot_read_the_credential_file_as_a_plan(self):
        old_args = sys.argv; old_reader = u1.read_private_json
        try:
            sys.argv = ['u1', '--plan', '/home/sigaer/taiko/config.json']
            u1.read_private_json = lambda *_: self.fail('CREDENTIAL_READ')
            with contextlib.redirect_stdout(io.StringIO()) as capture:
                self.assertEqual(u1.main(), 3)
            self.assertEqual(json.loads(capture.getvalue())['state'], 'PLAN_SCOPE_INVALID')
        finally:
            sys.argv = old_args; u1.read_private_json = old_reader

    def test_four_exact_requests_and_no_source_candidate_claim(self):
        result, session, sink = self.run_case()
        self.assertEqual(len(session.calls), 4)
        self.assertTrue(result['inputSetValidated'])
        self.assertFalse(result['atomicSnapshot'])
        self.assertIsNone(result['candidate'])
        self.assertEqual(result['candidateStatus'], 'AWAITING_ISOLATED_SOURCE_VALIDATION')
        specs = u1.request_specs(IDENTITY)
        for call, (_, method, path, body) in zip(session.calls, specs):
            self.assertEqual((call[0], call[1], call[2]['json']), (method, u1.ORIGIN + path, body))
            self.assertEqual(call[2]['timeout'], (3, 10))
            self.assertFalse(call[2]['allow_redirects'])
        self.assertEqual(sink.opens, 4)

    def test_identity_has_no_first_item_fallback(self):
        data = payloads(); data[1]['data']['players'] = [{'userid': '990000000000000002'}]
        result, session, _ = self.run_case([Response(v) for v in data])
        self.assertEqual(result['stopReason'], 'CASE_ID_MISMATCH_OR_AMBIGUOUS')
        self.assertEqual(len(session.calls), 2)

    def test_duplicate_exact_identity_is_ambiguous(self):
        data = payloads(); data[1]['data']['players'] = [{'userid': IDENTITY}] * 2
        result, session, _ = self.run_case([Response(v) for v in data])
        self.assertEqual(result['stopReason'], 'CASE_ID_MISMATCH_OR_AMBIGUOUS')
        self.assertEqual(len(session.calls), 2)

    def test_legacy_page_without_pagination_matches_existing_reader(self):
        data = payloads()
        data[0]['data']['playedRecords']['scoreInfo'] = [{} for _ in range(627)]
        del data[0]['data']['playedRecords']['pagination']
        result, session, _ = self.run_case([Response(v) for v in data])
        self.assertIsNone(result['stopReason'])
        self.assertEqual(len(session.calls), 4)
        self.assertTrue(result['inputSetValidated'])
        self.assertEqual(result['requests'][0]['pagination'], 'LEGACY_FIRST_PAGE_TOTAL_UNVERIFIED')
        self.assertIs(result['requests'][0]['upstreamCollectionComplete'], False)
        self.assertEqual(result['candidateStatus'], 'AWAITING_ISOLATED_SOURCE_VALIDATION')

    def test_unknown_pagination_alias_is_not_guessed(self):
        data = payloads(); paging = data[0]['data']['playedRecords']['pagination']; paging['totalCount'] = paging.pop('total')
        result, _, _ = self.run_case([Response(v) for v in data])
        self.assertEqual(result['stopReason'], 'PAGINATION_COMPLETENESS_UNKNOWN')

    def test_incomplete_or_boolean_total_stops(self):
        for total in [1, False]:
            data = payloads(); data[0]['data']['playedRecords']['pagination']['total'] = total
            result, session, _ = self.run_case([Response(v) for v in data])
            self.assertEqual(result['stopReason'], 'PAGINATION_INCOMPLETE')
            self.assertEqual(len(session.calls), 1)

    def test_page_boundary_does_not_create_a_second_page(self):
        data = payloads(); data[0]['data']['playedRecords']['scoreInfo'] = [{}] * 3000
        result, session, _ = self.run_case([Response(v) for v in data])
        self.assertEqual(result['stopReason'], 'PAGINATION_TRUNCATION_POSSIBLE')
        self.assertEqual(len(session.calls), 1)

    def test_redirect_and_http_failure_have_no_followup_or_retry(self):
        for status in [302, 401, 429, 500]:
            result, session, _ = self.run_case([Response({}, status=status)])
            self.assertEqual(result['stopReason'], 'HTTP_STATUS_REJECTED')
            self.assertEqual(len(session.calls), 1)

    def test_declared_oversize_does_not_read_body(self):
        result, session, sink = self.run_case([Response({}, headers={'Content-Length': str(u1.PER_RESPONSE + 1)})])
        self.assertEqual(result['stopReason'], 'RESPONSE_LENGTH_REJECTED')
        self.assertEqual(sink.opens, 0)
        self.assertEqual(len(session.calls), 1)

    def test_response_and_total_budget_never_exceeded(self):
        data = payloads()
        data[0]['padding'] = 'x' * (u1.PER_RESPONSE - 500)
        data[1]['padding'] = 'x' * (u1.PER_RESPONSE - 500)
        data[2]['padding'] = 'x' * 2000
        result, _, _ = self.run_case([Response(v) for v in data])
        self.assertEqual(result['stopReason'], 'RESPONSE_BUDGET_EXCEEDED')
        self.assertLessEqual(result['totalResponseBytes'], u1.TOTAL)
        self.assertTrue(all(r.get('bytes', 0) <= u1.PER_RESPONSE for r in result['requests']))

    def test_chunked_at_limit_fails_closed(self):
        result, _, _ = self.run_case([Response({}, raw=b'x' * u1.PER_RESPONSE, headers={})])
        self.assertEqual(result['stopReason'], 'RESPONSE_BUDGET_EXCEEDED')
        self.assertEqual(result['totalResponseBytes'], u1.PER_RESPONSE)

    def test_truncation_and_invalid_json_stop(self):
        for raw, headers, reason in [(b'{}', {'Content-Length': '20'}, 'RESPONSE_TRUNCATED'),
                                     (b'not json', {}, 'RESPONSE_JSON_INVALID')]:
            result, session, _ = self.run_case([Response({}, raw=raw, headers=headers)])
            self.assertEqual(result['stopReason'], reason)
            self.assertEqual(len(session.calls), 1)

    def test_compressed_body_is_not_silently_expanded(self):
        result, _, _ = self.run_case([Response({}, headers={'Content-Encoding': 'gzip'})])
        self.assertEqual(result['stopReason'], 'ENCODED_BODY_UNSUPPORTED')

    def test_wall_clock_expiry_stops_without_next_request(self):
        now = [0]
        response = Response(payloads()[0], advance=lambda: now.__setitem__(0, 58))
        result, session, _ = self.run_case([response], clock=lambda: now[0])
        self.assertEqual(result['stopReason'], 'WALL_DEADLINE')
        self.assertEqual(len(session.calls), 1)

    def test_exceptions_and_unknown_stop_messages_are_redacted(self):
        for error in [RuntimeError(SECRET), u1.U1Stop(SECRET)]:
            result, session, _ = self.run_case([error])
            self.assertNotIn(SECRET, json.dumps(result))
            self.assertEqual(len(session.calls), 1)

    def test_actual_transport_has_zero_retries_and_no_environment_credentials(self):
        session = u1.make_session(SECRET)
        try:
            self.assertFalse(session.trust_env)
            self.assertTrue(session.verify)
            self.assertEqual(session.get_adapter(u1.ORIGIN).max_retries.total, 0)
            self.assertEqual(session.headers['Accept-Encoding'], 'identity')
        finally:
            session.headers.clear(); session.close()

    def test_requests_session_rejects_redirect_before_implicit_body_consumption(self):
        import requests
        from requests.adapters import BaseAdapter
        class UnreadBody:
            reads = 0; closed = False
            def read(self, *_args, **_kwargs):
                self.reads += 1; raise AssertionError('REDIRECT_BODY_MUST_NOT_BE_READ')
            def stream(self, *_args, **_kwargs):
                self.reads += 1; raise AssertionError('REDIRECT_BODY_MUST_NOT_BE_READ')
                yield b''
            def close(self): self.closed = True
            def release_conn(self): pass
        class HeaderAdapter(BaseAdapter):
            calls = 0
            def send(self, request, **kwargs):
                self.calls += 1
                response = requests.Response(); response.request = request
                response.status_code = 302; response.url = request.url
                response.headers = {'Location': u1.ORIGIN + '/must-not-follow',
                                    'Content-Encoding': 'gzip',
                                    'Content-Length': str(u1.PER_RESPONSE + 1)}
                response.raw = raw
                return response
            def close(self): pass
        raw = UnreadBody(); adapter = HeaderAdapter(); session = u1.make_session(SECRET)
        session.mount('https://', adapter)
        result = u1.collect(IDENTITY, lambda: SECRET, lambda _: session, Sink, authorized=True)
        self.assertEqual(result['stopReason'], 'HTTP_STATUS_REJECTED')
        self.assertEqual(result['requests'][0]['status'], 302)
        self.assertEqual(adapter.calls, 1)
        self.assertEqual(raw.reads, 0)
        self.assertTrue(raw.closed)
        self.assertEqual(result['totalResponseBytes'], 0)
        self.assertTrue(all(r['state'] == 'NOT_ISSUED' for r in result['requests'][1:]))

    def test_private_evidence_modes(self):
        destination = ROOT / 'mode-check'
        sink = u1.PrivateResponses(destination)
        with sink.open_response(0) as stream: stream.write(b'synthetic')
        sink.save_summary({'case': 'synthetic'})
        self.assertEqual(destination.stat().st_mode & 0o777, 0o700)
        for p in destination.iterdir(): self.assertEqual(p.stat().st_mode & 0o777, 0o600)

    def test_private_input_is_bounded_and_symlinks_rejected(self):
        path = ROOT / 'oversize-input'
        path.write_bytes(b'x' * (1024**2 + 1))
        with self.assertRaisesRegex(u1.U1Stop, 'PRIVATE_INPUT_INVALID'):
            u1.read_private_bytes(path)
        link = ROOT / 'input-link'; link.symlink_to(path)
        with self.assertRaises(OSError): u1.read_private_bytes(link)

    def test_summary_excludes_identity_and_raw_body(self):
        result, _, _ = self.run_case()
        self.assertNotIn(IDENTITY, json.dumps(result))
        self.assertNotIn('players', json.dumps(result))

    def test_adapter_does_not_import_or_call_persistence_services(self):
        tree = ast.parse(Path(u1.__file__).read_text())
        forbidden = {'getUserData', 'save_userdata', 'dispatch_to_target', 'run_account_sync', 'publish', 'commit', 'execute'}
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else None
                self.assertNotIn(name, forbidden)
            if isinstance(node, ast.ImportFrom):
                self.assertFalse((node.module or '').startswith(('taiko_', 'pymysql', 'mysql')))

    def test_public_request_headers_match_installed_upstream_reader(self):
        source = Path('/opt/taiko-bot/current/lib/python3.11/site-packages/taiko_bot/runtime/player/center/update_user.py')
        tree = ast.parse(source.read_text())
        expected = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                for key, value in zip(node.keys, node.values):
                    if isinstance(key, ast.Constant) and key.value in ['User-Agent', 'Content-Type', 'Referer']:
                        expected[key.value] = ast.literal_eval(value)
        session = u1.make_session(SECRET)
        try:
            for key, value in expected.items(): self.assertEqual(session.headers[key], value)
            self.assertEqual(len(expected), 3)
        finally:
            session.headers.clear(); session.close()


if __name__ == '__main__':
    root = Path(os.environ['QA_RUN_TMPDIR']).resolve()
    assert '/qa-vault/runs/qa-' in str(root) and root.name == 'scratch'
    ROOT = root / 'u1-offline'
    ROOT.mkdir(mode=0o700)
    try:
        unittest.main()
    finally:
        shutil.rmtree(ROOT)
