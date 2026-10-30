"""Small semantic projections over ijson events; never a JSON lexer/parser.

Consume the complete document, including ignored fields and trailing bytes.
Object fields retain json.loads' last-value-wins behavior. Arrays retain only
counts and identity checks, so an unrelated dense JSON array is not materialized.
"""
import codecs
from decimal import Decimal
import json

from ijson.backends import yajl2_c as ijson
from ijson.common import JSONError


class ResponseValidationError(Exception):
    pass


class Frame:
    def __init__(self, role, kind):
        self.role = role
        self.kind = kind
        self.fields = {}
        self.key = None
        self.extra = False
        self.count = 0
        self.invalid = False
        self.matches = 0
        self.mismatch = False


CHILDREN = {
    'root': {'data': 'data', 'success': 'scalar'},
    'data': {'playedRecords': 'records', 'players': 'players', 'userid': 'scalar'},
    'records': {'scoreInfo': 'scores', 'pagination': 'pagination'},
    'pagination': {key: 'scalar' for key in ['page', 'pageSize', 'total', 'hasNext']},
    'song': {'userid': 'scalar'},
    'player': {'userid': 'scalar'},
}


def role_for(parent):
    if parent is None:
        return 'root'
    if parent.role == 'scores':
        return 'song'
    if parent.role == 'players':
        return 'player'
    return CHILDREN.get(parent.role, {}).get(parent.key)


def scalar(node):
    return node[1] if isinstance(node, tuple) else None


def identity_matches(node, identity):
    if not isinstance(node, tuple):
        return False
    value = node[1]
    # json.loads uses float for non-integer numbers. Keep its identity semantics
    # without imposing YAJL's use_float integer-size limit on 25-digit IDs.
    if isinstance(value, Decimal):
        value = float(value)
    return str(value) == identity


def attach(parent, node, identity):
    if parent.role in ('scores', 'players'):
        parent.count += 1
        is_map = isinstance(node, Frame) and node.kind == 'map'
        if parent.role == 'scores':
            parent.invalid |= not is_map
            if is_map and 'userid' in node.fields:
                parent.mismatch |= not identity_matches(node.fields['userid'], identity)
        elif is_map and identity_matches(node.fields.get('userid'), identity):
            parent.matches += 1
    elif parent.key in CHILDREN.get(parent.role, {}):
        parent.fields[parent.key] = node


class DeadlineReader:
    def __init__(self, source, remaining):
        self.source = source
        self.remaining = remaining
        remaining()
        head = source.read(4)
        encoding = json.detect_encoding(head)
        self.decoder = codecs.getincrementaldecoder(encoding)() if encoding != 'utf-8' else None
        self.pending = self.decoder.decode(head).encode('utf-8') if self.decoder else head
        self.eof = False

    def read(self, size):
        self.remaining()
        size = min(size, 65536)
        if size == 0:
            return b''
        while len(self.pending) < size and not self.eof:
            self.remaining()
            raw = self.source.read(size - len(self.pending))
            self.eof = not raw
            self.pending += self.decoder.decode(raw, final=self.eof).encode('utf-8') if self.decoder else raw
        result, self.pending = self.pending[:size], self.pending[size:]
        return result


def project(source, identity, remaining):
    stack = []
    root = None
    ignored_depth = 0
    ignored_node = None
    try:
        for event, value in ijson.basic_parse(DeadlineReader(source, remaining), buf_size=65536):
            if ignored_depth:
                if event in ('start_map', 'start_array'):
                    ignored_depth += 1
                elif event in ('end_map', 'end_array'):
                    ignored_depth -= 1
                    if not ignored_depth:
                        if stack:
                            attach(stack[-1], ignored_node, identity)
                        else:
                            root = ignored_node
                continue
            if event == 'map_key':
                frame = stack[-1]
                frame.key = value
                if frame.role == 'pagination' and value not in CHILDREN['pagination']:
                    frame.extra = True
                continue
            if event in ('start_map', 'start_array'):
                kind = event[6:]
                parent = stack[-1] if stack else None
                role = role_for(parent)
                wanted = 'array' if role in ('scores', 'players') else 'map'
                if role is None or role == 'scalar' or kind != wanted:
                    ignored_depth = 1
                    # A container cannot match a numeric identity or a scalar
                    # pagination field. Its contents are still fully parsed.
                    ignored_node = Frame('ignored', kind)
                else:
                    stack.append(Frame(role, kind))
                continue
            if event in ('end_map', 'end_array'):
                node = stack.pop()
                if stack:
                    attach(stack[-1], node, identity)
                else:
                    root = node
                continue
            node = (event, value)
            if stack:
                attach(stack[-1], node, identity)
            else:
                root = node
        remaining()
        return root
    except (JSONError, ValueError, UnicodeError, OverflowError):
        raise ResponseValidationError('RESPONSE_JSON_INVALID') from None


def mapping(node):
    return isinstance(node, Frame) and node.kind == 'map'


def array(node):
    return isinstance(node, Frame) and node.kind == 'array'


def validate_stream(kind, source, identity, remaining):
    root = project(source, identity, remaining)
    if not mapping(root) or not mapping(root.fields.get('data')) or root.fields.get('success') == ('boolean', False):
        raise ResponseValidationError('RESPONSE_STRUCTURE_INVALID')
    data = root.fields['data'].fields
    if kind == 'songs':
        records = data.get('playedRecords')
        rows = records.fields.get('scoreInfo') if mapping(records) else None
        if not array(rows) or rows.invalid:
            raise ResponseValidationError('SONGS_STRUCTURE_INVALID')
        if rows.count >= 3000:
            raise ResponseValidationError('PAGINATION_TRUNCATION_POSSIBLE')
        # Existing Wahlap readers consume scoreInfo from page 1 without
        # pagination metadata. Do not infer that the full collection was sent.
        if 'pagination' not in records.fields:
            if rows.mismatch:
                raise ResponseValidationError('CASE_ID_MISMATCH')
            return {'structureValid': True, 'pagination': 'LEGACY_FIRST_PAGE_TOTAL_UNVERIFIED',
                    'recordCount': rows.count, 'actualUpstreamSchemaProven': False,
                    'upstreamCollectionComplete': False}
        paging = records.fields['pagination']
        if not mapping(paging) or paging.extra or set(paging.fields) != set(CHILDREN['pagination']):
            raise ResponseValidationError('PAGINATION_COMPLETENESS_UNKNOWN')
        values = {key: scalar(value) for key, value in paging.fields.items()}
        if (type(values['page']) is not int or values['page'] != 1
                or type(values['pageSize']) is not int or values['pageSize'] != 3000
                or type(values['total']) is not int or values['total'] != rows.count
                or values['hasNext'] is not False):
            raise ResponseValidationError('PAGINATION_INCOMPLETE')
        if rows.mismatch:
            raise ResponseValidationError('CASE_ID_MISMATCH')
        return {'structureValid': True, 'pagination': 'EXPLICIT_SINGLE_PAGE_CHECK_PASSED',
                'recordCount': rows.count, 'actualUpstreamSchemaProven': False}
    if kind == 'profile':
        players = data.get('players')
        if not array(players):
            raise ResponseValidationError('PROFILE_STRUCTURE_INVALID')
        if players.matches != 1:
            raise ResponseValidationError('CASE_ID_MISMATCH_OR_AMBIGUOUS')
        return {'structureValid': True, 'exactCaseIdentity': True, 'fallbackUsed': False}
    if 'userid' in data and not identity_matches(data['userid'], identity):
        raise ResponseValidationError('CASE_ID_MISMATCH')
    return {'structureValid': True, 'identityBasis': 'exact-profile-and-case-scoped-HTTPS-request'}
