#!/usr/bin/env python3
"""One-case, explicitly authorized upstream read. No production persistence.

Default CLI mode checks the execution plan without loading credentials, opening
a session, or creating response files. A plan flag is a guard, not user consent.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import stat
import sys
import time

ORIGIN = 'https://wl-taiko.wahlap.net'
PRIVATE_ROOT = Path('/home/sigaer/taiko/qa-vault/evidence/viewer-u1-preparation-20261026/private')
PER_RESPONSE = 8 * 1024**2
TOTAL = 16 * 1024**2
BODY_SECONDS = 57
UPSTREAM_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541020) XWEB/16459'
STOP_CODES = set('''PRIVATE_INPUT_INVALID PRIVATE_INPUT_TOO_LARGE CASE_ID_INVALID
RESPONSE_STRUCTURE_INVALID SONGS_STRUCTURE_INVALID PAGINATION_TRUNCATION_POSSIBLE
PAGINATION_COMPLETENESS_UNKNOWN PAGINATION_INCOMPLETE CASE_ID_MISMATCH
PROFILE_STRUCTURE_INVALID CASE_ID_MISMATCH_OR_AMBIGUOUS BLOCKED_PENDING_EXPLICIT_U1_AUTHORIZATION
WALL_DEADLINE CREDENTIAL_UNAVAILABLE HTTP_STATUS_REJECTED ENCODED_BODY_UNSUPPORTED
RESPONSE_LENGTH_REJECTED RESPONSE_BUDGET_EXCEEDED RESPONSE_TRUNCATED RESPONSE_JSON_INVALID
UNREVIEWED_ADAPTER_VERSION AUTHORIZATION_EXPIRED CASE_FILE_OUTSIDE_PRIVATE_SCOPE
CASE_STATE_CHANGED FRESH_CASE_PRECHECK_REQUIRED EVIDENCE_SCOPE_INVALID QA_ISOLATION_REQUIRED
RESOURCE_ADMISSION_DENIED PLAN_SCOPE_INVALID PARSER_DEPENDENCY_UNAVAILABLE'''.split())


class U1Stop(Exception):
    """Contains an allowlisted category only, never a response or exception."""
    def __init__(self, category, http_status=None):
        super().__init__(category if category in STOP_CODES else 'UNCLASSIFIED_U1_FAILURE')
        self.http_status = http_status if type(http_status) is int and 100 <= http_status <= 599 else None


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_private_bytes(path, maximum=1024**2):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise U1Stop('PRIVATE_INPUT_INVALID')
        raw = source.read(maximum + 1)
    if len(raw) > maximum:
        raise U1Stop('PRIVATE_INPUT_TOO_LARGE')
    return raw


def read_private_json(path, maximum=1024**2):
    return json.loads(read_private_bytes(path, maximum))


def request_specs(identity):
    if not isinstance(identity, str) or not re.fullmatch(r'[0-9]{1,25}', identity):
        raise U1Stop('CASE_ID_INVALID')
    return [
        ('songs', 'POST', '/api/user/all/songs',
         {'page': 1, 'pageSize': 3000, 'sort': 1, 'isPlayed': True, 'userid': identity}),
        ('profile', 'POST', '/api/user/search/player',
         {'keyword': identity, 'page': 1, 'pageSize': 10}),
        ('achievement', 'GET', '/api/game/player/achievement/' + identity, None),
        ('dojo', 'GET', '/api/game/dojo/score/' + identity, None),
    ]


JSON_VALIDATOR_SHA256 = 'd209b81b94c5e72c0fe6ff980fc441735c2446d8e8eb4a516b9692b295079501'
_JSON_VALIDATOR = None


def json_validator():
    global _JSON_VALIDATOR
    if _JSON_VALIDATOR is None:
        import importlib.util
        source = Path(__file__).with_name('source_u1_json.py')
        if sha(source.read_bytes()) != JSON_VALIDATOR_SHA256:
            raise U1Stop('UNREVIEWED_ADAPTER_VERSION')
        spec = importlib.util.spec_from_file_location('source_u1_json', source)
        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except ImportError:
            raise U1Stop('PARSER_DEPENDENCY_UNAVAILABLE') from None
        _JSON_VALIDATOR = module
    return _JSON_VALIDATOR


class PrivateResponses:
    def __init__(self, directory):
        directory.mkdir(mode=0o700)
        self.directory = directory

    def open_response(self, index):
        fd = os.open(self.directory / f'{index:02d}.response',
                     os.O_CREAT | os.O_EXCL | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        return os.fdopen(fd, 'w+b')

    def save_summary(self, summary):
        fd = os.open(self.directory / 'u1-summary.json',
                     os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(summary, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())


def collect(identity, credential_provider, session_factory, sink_factory, *, authorized=False,
            clock=time.monotonic):
    if authorized is not True:
        raise U1Stop('BLOCKED_PENDING_EXPLICIT_U1_AUTHORIZATION')
    validator = json_validator()
    specs = request_specs(identity)
    deadline = clock() + BODY_SECONDS
    rows = [{'endpoint': kind, 'state': 'NOT_ISSUED'} for kind, *_ in specs]
    summary = {'case': 'B1-CURRENT-01', 'requests': rows, 'stopReason': None,
               'sourceOrigin': ORIGIN, 'atomicSnapshot': False, 'candidate': None,
               'candidateStatus': 'NOT_VERIFIED', 'productionWrites': 0,
               'concurrency': 1, 'maximumRequests': 4, 'retries': 0,
               'redirectsFollowed': 0, 'requiresSeparateW1Authorization': True}
    session = None
    sink = None
    total = 0

    def remaining():
        seconds = deadline - clock()
        if seconds <= 0:
            raise U1Stop('WALL_DEADLINE')
        return seconds

    try:
        remaining()
        credential = credential_provider()
        if not isinstance(credential, str) or not credential.strip() or '\n' in credential or '\r' in credential:
            raise U1Stop('CREDENTIAL_UNAVAILABLE')
        session = session_factory(credential)
        sink = sink_factory()
        for index, (kind, method, path, body) in enumerate(specs):
            remaining()
            if total >= TOTAL:
                raise U1Stop('RESPONSE_BUDGET_EXCEEDED')
            row = rows[index]
            row.update(state='ISSUED', atUtc=dt.datetime.now(dt.timezone.utc).isoformat(),
                       method=method, status=None, bytes=0, sha256=None, complete=False,
                       transportComplete=False)
            response = None
            digest = None
            try:
                seconds = remaining()
                response = session.request(method, ORIGIN + path, json=body, stream=True,
                                           allow_redirects=False, timeout=(min(3, seconds), min(10, seconds)))
                row['status'] = response.status_code
                if response.status_code not in (200, 201):
                    raise U1Stop('HTTP_STATUS_REJECTED')
                encoding = response.headers.get('Content-Encoding', '').strip().lower()
                if encoding not in ('', 'identity'):
                    raise U1Stop('ENCODED_BODY_UNSUPPORTED')
                length = response.headers.get('Content-Length')
                if length is not None and (not length.isdecimal() or int(length) > PER_RESPONSE):
                    raise U1Stop('RESPONSE_LENGTH_REJECTED')
                digest = hashlib.sha256()
                with sink.open_response(index) as target:
                    while True:
                        remaining()
                        allowance = min(PER_RESPONSE - row['bytes'], TOTAL - total)
                        if allowance <= 0:
                            raise U1Stop('RESPONSE_BUDGET_EXCEEDED')
                        chunk = response.raw.read(min(65536, allowance), decode_content=False)
                        if not chunk:
                            break
                        if len(chunk) > allowance:
                            raise U1Stop('RESPONSE_BUDGET_EXCEEDED')
                        row['bytes'] += len(chunk)
                        total += len(chunk)
                        digest.update(chunk)
                        target.write(chunk)
                        if length is not None and row['bytes'] == int(length):
                            break
                    target.flush()
                    os.fsync(target.fileno())
                    row['sha256'] = digest.hexdigest()
                    if length is not None and row['bytes'] != int(length):
                        raise U1Stop('RESPONSE_TRUNCATED')
                    row['transportComplete'] = True
                    remaining()
                    target.seek(0)
                    try:
                        row.update(validator.validate_stream(kind, target, identity, remaining))
                    except validator.ResponseValidationError as error:
                        raise U1Stop(str(error)) from None
                row.update(state='VALIDATED', complete=True)
                remaining()
            finally:
                if digest is not None:
                    row['sha256'] = digest.hexdigest()
                    row['sha256Scope'] = 'received-body-within-size-bounds'
                if response is not None:
                    response.close()
                session.cookies.clear()
        summary['inputSetValidated'] = True
        summary['candidateStatus'] = 'AWAITING_ISOLATED_SOURCE_VALIDATION'
    except U1Stop as error:
        summary['stopReason'] = str(error)
        if error.http_status is not None:
            for row in reversed(rows):
                if row['state'] == 'ISSUED':
                    row['status'] = error.http_status
                    break
    except Exception:
        # Network/JSON/provider exceptions can embed IDs, paths and secrets.
        summary['stopReason'] = 'SANITIZED_EXECUTION_FAILURE'
    finally:
        if session is not None:
            try:
                session.headers.clear()
                session.close()
            except Exception:
                summary['stopReason'] = 'SESSION_CLEANUP_FAILED'
        summary['endUtc'] = dt.datetime.now(dt.timezone.utc).isoformat()
        summary['totalResponseBytes'] = total
        if sink is not None:
            try:
                sink.save_summary(summary)
            except Exception:
                summary['stopReason'] = 'PRIVATE_EVIDENCE_COMMIT_FAILED'
    return summary


def make_session(credential):
    import requests
    from requests.adapters import HTTPAdapter
    session = requests.Session()
    session.trust_env = False
    session.mount('https://', HTTPAdapter(max_retries=0))
    def reject_unsafe_status(response, *_, **__):
        # Requests may consume a redirect's body to populate Response.next even
        # with allow_redirects=False. Hooks run before that resolver/cookie work.
        if response.status_code not in (200, 201):
            status = response.status_code
            response.close()
            raise U1Stop('HTTP_STATUS_REJECTED', http_status=status)
        return response
    session.hooks['response'] = [reject_unsafe_status]
    session.headers.update({'Authorization': credential, 'Accept-Encoding': 'identity',
                            'Content-Type': 'application/json',
                            'Referer': 'https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html',
                            'User-Agent': UPSTREAM_USER_AGENT})
    return session


def authorize_plan(plan):
    if (plan.get('authorizationStatus') != 'EXPLICIT_USER_U1_ONLY'
            or not plan.get('authorizationReference')):
        raise U1Stop('BLOCKED_PENDING_EXPLICIT_U1_AUTHORIZATION')
    if plan.get('adapterSha256') != sha(Path(__file__).read_bytes()):
        raise U1Stop('UNREVIEWED_ADAPTER_VERSION')
    expiry = dt.datetime.fromisoformat(plan['expiresAtUtc'])
    if expiry.tzinfo is None or expiry <= dt.datetime.now(dt.timezone.utc):
        raise U1Stop('AUTHORIZATION_EXPIRED')
    case_file = Path(plan['caseStateFile'])
    if not case_file.resolve().is_relative_to(PRIVATE_ROOT):
        raise U1Stop('CASE_FILE_OUTSIDE_PRIVATE_SCOPE')
    raw = read_private_bytes(case_file)
    if sha(raw) != plan.get('caseStateSha256'):
        raise U1Stop('CASE_STATE_CHANGED')
    case = json.loads(raw)
    checked = dt.datetime.fromisoformat(case['checkedAtUtc'])
    age = (dt.datetime.now(dt.timezone.utc) - checked).total_seconds()
    if not 0 <= age <= 300 or case['case'] != 'B1-CURRENT-01' or case['lockedSongs'] != 0:
        raise U1Stop('FRESH_CASE_PRECHECK_REQUIRED')
    request_specs(case['identity'])
    destination = Path(plan['evidenceDirectory'])
    if destination.parent.resolve() != PRIVATE_ROOT or destination.exists():
        raise U1Stop('EVIDENCE_SCOPE_INVALID')
    return case, destination


def main():
    sys.dont_write_bytecode = True
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    try:
        plan_path = Path(args.plan)
        if plan_path.parent.resolve() != PRIVATE_ROOT or plan_path.name != 'u1-plan.json':
            raise U1Stop('PLAN_SCOPE_INVALID')
        plan = read_private_json(args.plan)
        if not args.execute:
            print(json.dumps({'mode': 'PREPARATION_ONLY', 'authorizationStatus': plan.get('authorizationStatus'),
                              'cookieRead': False, 'networkSessionCreated': False, 'upstreamRequests': 0}))
            return 0
        # These guards precede every credential read, response directory and session.
        case, destination = authorize_plan(plan)
        if '/development.slice/development-qa.slice/' not in Path('/proc/self/cgroup').read_text():
            raise U1Stop('QA_ISOLATION_REQUIRED')
        mem = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
        pressure = float(re.search(r'full avg10=([\d.]+)', Path('/proc/pressure/memory').read_text())[1])
        if mem['MemAvailable'] < .25 * mem['MemTotal'] + 3 * 1024**2 or pressure >= 2:
            raise U1Stop('RESOURCE_ADMISSION_DENIED')
        def stop(*_):
            raise U1Stop('WALL_DEADLINE')
        signal.signal(signal.SIGALRM, stop)
        signal.signal(signal.SIGTERM, stop)
        signal.setitimer(signal.ITIMER_REAL, BODY_SECONDS)
        try:
            summary = collect(case['identity'],
                              lambda: read_private_json('/home/sigaer/taiko/config.json').get('cookie'),
                              make_session, lambda: PrivateResponses(destination), authorized=True)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
        print(json.dumps(summary))
        return 0 if summary.get('inputSetValidated') and not summary.get('stopReason') else 2
    except U1Stop as error:
        print(json.dumps({'state': str(error), 'upstreamNotStartedUnlessReported': True,
                          'candidate': None, 'requiresSeparateW1Authorization': True}))
        return 3
    except Exception:
        print(json.dumps({'state': 'SANITIZED_PREFLIGHT_FAILURE', 'candidate': None}))
        return 3


if __name__ == '__main__':
    sys.exit(main())
