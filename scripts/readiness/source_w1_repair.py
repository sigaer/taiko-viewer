"""Exact forward-only repair over the installed Publication kernel.

The boundary module supplies a sealed plan and a live authorization check.
Recovery never tries to reinstall the already damaged parent object.
"""
import hashlib
import json
import os
from pathlib import Path
import stat

from taiko_store.publication import (
    PublicationError, PublicationStore, _atomic_bytes, _fsync_directory, _json,
)


def fingerprint(path):
    digest = hashlib.sha256()
    size = 0
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise PublicationError('W1_INPUT_NOT_REGULAR')
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
            size += len(block)
    return {'bytes': size, 'sha256': digest.hexdigest()}


class RepairStore(PublicationStore):
    """The reviewed rehearsal's recovery, restricted to one sealed receipt."""

    def __init__(self, plan, authorize, **kwargs):
        self.plan = json.loads(_json(plan))
        self.authorize = authorize
        authorize('preflight')
        super().__init__(plan['root'], plan['identity'], **kwargs)

    def _validate_repair(self, current, following):
        p = self.plan
        self._validate_manifest(following)
        if current != p['parent'] and current != following:
            raise PublicationError('W1_PARENT_CHANGED')
        expected = {**p['parent']['files'], 'current': p['candidate']}
        if (following['identity'] != self.identity
                or following['sequence'] != p['parent']['sequence'] + 1
                or following.get('previousCommitId') != p['parent']['commitId']
                or following['commitId'] != p['transactionId']
                or following.get('dependencyHash') != p['approvalDigest']
                or following['files'] != expected):
            raise PublicationError('W1_RECEIPT_OUTSIDE_SCOPE')
        for field in ('fileMtimes', 'fileCtimes'):
            if {k: v for k, v in following.get(field, {}).items() if k != 'current'} != {
                    k: v for k, v in p['parent'].get(field, {}).items() if k != 'current'}:
                raise PublicationError('W1_HISTORY_METADATA_CHANGED')
        for reference in following['files'].values():
            self.read_object(reference)
        if fingerprint(self.objects / p['parent']['files']['current']['sha256']) != p['badActual']:
            raise PublicationError('W1_FORENSIC_PARENT_CHANGED')

    def _recover(self):
        # Called by exclusive() before its body and by publish() on failure.
        self.authorize('locked')
        pending_path = self.base / 'pending.json'
        if not pending_path.exists():
            return
        p = self.plan
        expected = {'schema': 1, 'identity': self.identity,
                    'previousCommitId': p['parent']['commitId'],
                    'nextCommitId': p['transactionId'], 'changedKeys': ['current']}
        if self._read_json(pending_path) != expected:
            raise PublicationError('W1_FOREIGN_PENDING')
        following = self._read_json(self.commits / (p['transactionId'] + '.json'))
        self._validate_repair(self.view(), following)
        self.authorize('locked')
        self._install('current', p['candidate'])
        self.fault('repair-projection-installed')
        _atomic_bytes(self.base / 'committed.json', _json(following))
        self.fault('repair-commit-durable')
        pending_path.unlink()
        _fsync_directory(self.base)
        self.fault('repair-pending-cleared')

    def publish(self, changes, **kwargs):
        self.authorize('locked')
        if (changes != {'current': self.plan['candidate']}
                or kwargs != {'transaction_id': self.plan['transactionId'],
                              'dependency_hash': self.plan['approvalDigest']}):
            raise PublicationError('W1_WRITE_OUTSIDE_SCOPE')
        return super().publish(changes, **kwargs)

    def confirm_current(self, view):
        self.authorize('locked')
        self._validate_repair(view, view)
        raw = self.reader().current_raw()
        if ({'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()} != self.plan['candidate']
                or fingerprint(self.root / (self.identity + 'data.json')) != self.plan['candidate']):
            raise PublicationError('W1_READER_OR_PROJECTION_INVALID')


def repair(plan, authorize, *, fault=None, before_stage=None):
    """No retry loop. A new invocation may confirm/resume this exact repair."""
    if fingerprint(plan['candidatePath']) != plan['candidate']:
        raise PublicationError('W1_CANDIDATE_CHANGED')
    store = RepairStore(plan, authorize, fault=fault)
    with store.exclusive():
        current = store.view()
        if current['commitId'] == plan['transactionId']:
            store.confirm_current(current)
            return current, 'ALREADY_COMMITTED'
        if current != plan['parent']:
            raise PublicationError('W1_PARENT_CHANGED')
        if fingerprint(store.objects / current['files']['current']['sha256']) != plan['badActual']:
            raise PublicationError('W1_FORENSIC_PARENT_CHANGED')
        if fingerprint(store.root / (store.identity + 'data.json')) != plan['badActual']:
            raise PublicationError('W1_PARENT_PROJECTION_CHANGED')
        for key, reference in current['files'].items():
            if key != 'current':
                store.read_object(reference)
        authorize('locked')
        if before_stage is not None:
            before_stage(store)
        # One bounded candidate, verified on the same descriptor used to stage.
        with Path(plan['candidatePath']).open('rb') as stream:
            payload = stream.read(plan['candidate']['bytes'] + 1)
        if {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()} != plan['candidate']:
            raise PublicationError('W1_CANDIDATE_CHANGED')
        reference = store.stage(payload)
        following = store.publish({'current': reference}, transaction_id=plan['transactionId'],
                                  dependency_hash=plan['approvalDigest'])
        store.confirm_current(following)
        return following, 'COMMITTED'
