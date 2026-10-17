"""Synthetic writer adapter fixture. Run with an installed role Python and -I.

Only SQL song-lock lookup and daily compute are stubbed: this verifies the real
save_userdata / dispatcher publication paths, not upstream/auth/daily lifecycle.
"""
import errno
import json
import os
from pathlib import Path
import socket
import sys
import types

root = Path(sys.argv[1]).resolve()
assert root.is_dir() and str(root).startswith('/var/tmp/')
identity, writer, fault = 'synthetic', sys.argv[2], sys.argv[3]
for key in ('TAIKO_CENTER_ROOT', 'TAIKO_RUNTIME_ROOT', 'TAIKO_OFFLINE_ROOT', 'TAIKO_USERDATA_DIR'):
    os.environ[key] = str(root)
# The fixture has no reason to use a network or database, even if inherited
# configuration accidentally offers one. Unix sockets are unnecessary too.
def deny_network(*args, **kwargs):
    raise AssertionError('Network access forbidden in synthetic writer fixture')
socket.socket.connect = deny_network
from taiko_store import PublicationStore
import taiko_store
assert '/site-packages/' in taiko_store.__file__ and sys.flags.isolated
if writer in ('wahlap', 'hiroba'):
    from taiko_bot.runtime.player.center import userdata_storage
    userdata_storage._load_locked_song_keys = lambda _: set()
    daily = types.ModuleType('taiko_bot.runtime.player.center.daily_ability')
    daily.capture_snapshot = lambda *args, **kwargs: None
    sys.modules[daily.__name__] = daily
elif writer == 'dispatcher':
    from taiko_bot.services.sync_dispatch_server import write_local_snapshot
else:
    raise AssertionError('Unknown fixture writer')

def inject(point):
    if point == fault:
        os._exit(77)
    if fault == 'enospc' and point == 'projection-0':
        raise OSError(errno.ENOSPC, 'Synthetic disk exhaustion')

store = PublicationStore(root, identity, fault=inject, lock_timeout=5)
print('READY', flush=True)
with store.exclusive():
    payload = json.loads(store.reader().current_raw())
    payload['profile']['trace'].append(writer)
    if writer == 'dispatcher':
        write_local_snapshot(identity, payload, publication_store=store)
    else:
        userdata_storage.save_userdata(identity, payload, source=writer, publication_store=store)
print('COMMITTED', flush=True)
