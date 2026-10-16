# Adapted frozen Sakura test fixture: installed imports only; upstream replies remain synthetic.
"""Owned native CLI fixture: original playable-card discovery, only upstream SDK
card replies are synthetic. SQL and production storage access are forbidden."""
import json
import os
import signal
import sys
import time
import types
from pathlib import Path
import importlib.util
assert sys.flags.isolated == 1
for _package in ("taiko_bot", "taiko_store", "runtime_memory"):
    _origin = Path(importlib.util.find_spec(_package).origin).resolve()
    assert _origin.is_relative_to(Path(sys.prefix).resolve()), "Product module outside installed environment"
import pymysql
import requests


options = json.loads(Path(sys.argv[1]).read_text())
owned = Path(options["root"]).resolve()
scratch = Path(os.environ["QA_RUN_TMPDIR"]).resolve()
assert scratch == Path(os.environ["QA_RUN_DIR"]).resolve() / "scratch"
assert owned.parent == scratch and owned.name.startswith("manual-source-sql-")
assert not Path(options["root"]).is_symlink()
assert Path(os.environ["TAIKO_USERDATA_DIR"]).resolve() == owned / "userdata"


def guard(event, args):
    if event == "open" and isinstance(args[0], (str, bytes)):
        path = Path(os.fsdecode(args[0])).resolve()
        mode, flags = args[1], args[2]
        write = (isinstance(mode, str) and any(c in mode for c in "wax+")) or (isinstance(flags, int) and flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT))
        if write and path != owned and owned not in path.parents:
            raise PermissionError("Owned crypto worker cannot write outside fixture")
        if str(path).startswith(("/home/sigaer/taiko/userdata", "/home/sigaer/taiko-bot/storage", "/home/sigaer/git/Sakura_bot/taiko/userdata", "/home/sigaer/taiko/secrets")) or str(path) in {"/etc/taiko-runtime.env", "/home/sigaer/taiko/config.json"} or path.name == ".env":
            raise PermissionError("Owned crypto worker cannot read production storage or secrets file")


sys.addaudithook(guard)
pymysql.connect = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Crypto worker must not connect to SQL"))
requests.sessions.Session.send = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Owned worker cannot send HTTP"))
from taiko_bot.cli.hiroba_credential_cli import main
from taiko_bot.runtime.player.center.hiroba.client import HirobaClient


def cards(*args, **kwargs):
    (owned / "credential-discovered.json").write_text('{"ready":true}')
    if options.get("point") == "pause":
        deadline = time.monotonic() + 10
        while not (owned / "credential-release.json").exists():
            assert time.monotonic() < deadline
            time.sleep(0.01)
    if options.get("point") == "fail": raise RuntimeError("Private upstream /password/hash")
    if options.get("point") == "death": os._exit(73)
    if options.get("point") == "alarm":
        signal.alarm(1); time.sleep(5)
    return [types.SimpleNamespace(taiko_no=value, has_play_data=True) for value in options["ids"]]


HirobaClient.list_login_cards = cards
main()
