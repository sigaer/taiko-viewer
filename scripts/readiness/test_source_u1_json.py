"""Targeted streaming projection and complete-document regression checks."""
import importlib.util
import io
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('u1_stream_adapter', Path(__file__).with_name('source_u1_readonly.py'))
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
parser = adapter.json_validator()
IDENTITY = '990000000000000001'


def songs(rows=None):
    rows = [] if rows is None else rows
    return {'data': {'playedRecords': {'scoreInfo': rows, 'pagination':
            {'page': 1, 'pageSize': 3000, 'total': len(rows), 'hasNext': False}}}}


class StreamingProjectionTests(unittest.TestCase):
    def parse(self, kind, value):
        raw = value if isinstance(value, bytes) else json.dumps(value).encode()
        return parser.validate_stream(kind, io.BytesIO(raw), IDENTITY, lambda: None)

    def reject(self, category, kind, value):
        with self.assertRaisesRegex(parser.ResponseValidationError, '^' + category + '$'):
            self.parse(kind, value)

    def test_songs_records_are_checked_individually(self):
        self.assertEqual(self.parse('songs', songs([{}, {'userid': IDENTITY}]))['recordCount'], 2)
        self.reject('SONGS_STRUCTURE_INVALID', 'songs', songs([[]]))
        self.reject('CASE_ID_MISMATCH', 'songs', songs([{'userid': 'other'}]))
        self.reject('PAGINATION_TRUNCATION_POSSIBLE', 'songs', songs([{}] * 3000))

    def test_strict_pagination_types_and_unknown_keys(self):
        for key, wrong in [('page', True), ('page', 1.0), ('pageSize', 10), ('total', False), ('hasNext', 0)]:
            value = songs()
            value['data']['playedRecords']['pagination'][key] = wrong
            self.reject('PAGINATION_INCOMPLETE', 'songs', value)
        value = songs()
        value['data']['playedRecords']['pagination']['extra'] = 0
        self.reject('PAGINATION_COMPLETENESS_UNKNOWN', 'songs', value)
        del value['data']['playedRecords']['pagination']
        self.reject('PAGINATION_COMPLETENESS_UNKNOWN', 'songs', value)

    def test_profile_unique_exact_match_and_container_identity(self):
        self.assertTrue(self.parse('profile', {'data': {'players': [None, [], {}, {'userid': IDENTITY}]}})['exactCaseIdentity'])
        for rows in [[], [{'userid': IDENTITY}] * 2, [{'userid': [IDENTITY]}], [{'userid': {'userid': IDENTITY}}]]:
            self.reject('CASE_ID_MISMATCH_OR_AMBIGUOUS', 'profile', {'data': {'players': rows}})
        self.reject('PROFILE_STRUCTURE_INVALID', 'profile', {'data': {'players': {}}})

    def test_other_responses_have_the_same_identity_rule(self):
        for kind in ['achievement', 'dojo']:
            self.parse(kind, {'data': {}})
            self.parse(kind, {'data': {'userid': int(IDENTITY)}})
            self.reject('CASE_ID_MISMATCH', kind, {'data': {'userid': None}})
            self.reject('RESPONSE_STRUCTURE_INVALID', kind, {'data': [], 'success': True})
            self.reject('RESPONSE_STRUCTURE_INVALID', kind, {'data': {}, 'success': False})
            self.parse(kind, {'data': {}, 'success': 0})

    def test_duplicate_fields_keep_last_value_and_last_container(self):
        self.parse('dojo', b'{"success":false,"success":true,"data":[],"data":{}}')
        self.parse('profile', ('{"data":{"players":[],"players":[{"userid":"wrong","userid":"' + IDENTITY + '"}]}}').encode())
        self.reject('RESPONSE_STRUCTURE_INVALID', 'dojo', b'{"data":{},"data":[]}')
        self.reject('CASE_ID_MISMATCH', 'dojo', ('{"data":{"userid":"' + IDENTITY + '","userid":[]}}').encode())

    def test_dotted_keys_and_unknown_arrays_cannot_spoof_paths(self):
        self.reject('PROFILE_STRUCTURE_INVALID', 'profile', ('{"data":{"players.item.userid":"' + IDENTITY + '"}}').encode())
        value = songs()
        value['padding'] = [{'data': {'userid': 'wrong'}}] * 100
        self.parse('songs', value)

    def test_invalid_tail_and_ignored_fields_are_still_parsed(self):
        for raw in [b'{"data":{}} garbage', b'{"data":{}}{}', b'{"data":{},"ignored":[}',
                    b'{"data":{},"ignored":"\\uZZZZ"}', b'{"data":{},"ignored":"\xff"}']:
            self.reject('RESPONSE_JSON_INVALID', 'dojo', raw)

    def test_bounded_reader_and_parse_deadline_are_used(self):
        calls = []
        class Source(io.BytesIO):
            def read(self, size):
                self_size = size
                if self_size > 65536:
                    raise AssertionError('unbounded read')
                return super().read(size)
        parser.validate_stream('dojo', Source(b'{"data":{}}'), IDENTITY, lambda: calls.append(True))
        self.assertGreater(len(calls), 1)

    def test_stdlib_supported_unicode_encodings_and_bom(self):
        text = '{"data":{},"padding":"\u6d4b\u8bd5\U0001f600"}'
        for encoding in ['utf-8', 'utf-8-sig', 'utf-16', 'utf-16-le', 'utf-16-be', 'utf-32', 'utf-32-le', 'utf-32-be']:
            self.parse('dojo', text.encode(encoding))
        self.reject('RESPONSE_JSON_INVALID', 'dojo', text.encode('utf-16-le') + b'x')


if __name__ == '__main__':
    unittest.main()
