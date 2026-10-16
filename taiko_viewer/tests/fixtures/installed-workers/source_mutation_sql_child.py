# Adapted frozen Sakura test fixture: installed imports only; upstream replies remain synthetic.
"""Actual private CLI/dispatcher/acquisition, native isolated SQL, fake remote HTTP.

Only remote replies and daily calculations are synthetic. Every native SQL
connection proves SELECT DATABASE; all files/writes stay in the owned fixture.
"""
import json
import os
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

options = json.loads(Path(sys.argv[1]).read_text())
owned = Path(options["root"]).resolve()
assert str(owned).startswith("/var/tmp/manual-source-sql-")
# Explicit synthetic catalog needed by installed center dojo normalization.
(owned / "songs").mkdir(exist_ok=True)
(owned / "songs" / "grade_dojo_nijiiro_2025_simple.json").write_text('{"grades":[]}')
assert os.environ.get("TAIKO_ALLOW_TEST_DB_MUTATION") == "1"
expected_database = os.environ["TAIKO_DB_NAME"]
assert expected_database.endswith("_test")
assert Path(os.environ["TAIKO_USERDATA_DIR"]).resolve() == owned / "userdata"
os.environ["TAIKO_WAHLAP_CONFIG_PATH"] = str(owned / "proxy-wahlap.json")
os.environ["TAIKO_HIROBA_TOKEN_DIR"] = str(owned / "hiroba-tokens")
os.environ["TAIKO_HIROBA_COOLDOWN_PATH"] = str(owned / "hiroba-cooldown.json")
(owned / "proxy-wahlap.json").write_text('{"cookie":"synthetic-public-cookie"}')

def checkpoint(name):
    (owned / ("proxy-" + name + ".json")).write_text('{"ready":true}')

def pause(name):
    if options.get("pause") == name:
        deadline = time.monotonic() + 10
        while not (owned / "proxy-release.json").exists():
            assert time.monotonic() < deadline, "Owned sync pause deadline"
            time.sleep(0.01)

point = options.get("point")
faulted = False
main_connections = 0
native_connect = pymysql.connect

class Cursor:
    def __init__(self, cursor):
        self.raw = cursor
    def execute(self, sql, args=None):
        if point == "proof-failure" and main_connections and sql.startswith("SELECT CAST(id AS CHAR),taiko_id"):
            raise pymysql.err.OperationalError(1000, "Synthetic private SQL /password/hash")
        return self.raw.execute(sql, args)
    def fetchone(self):
        return self.raw.fetchone()
    def fetchall(self):
        return self.raw.fetchall()
    def close(self):
        return self.raw.close()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.close()
    @property
    def lastrowid(self):
        return self.raw.lastrowid

class Connection:
    def __init__(self, raw, is_main):
        self.raw, self.is_main = raw, is_main
        self.begun = False
    def cursor(self):
        return Cursor(self.raw.cursor())
    def begin(self):
        self.begun = True
        return self.raw.begin()
    def commit(self):
        global faulted
        if not self.begun:
            self.raw.commit()
            if self.is_main:
                checkpoint("optimistic")
                pause("optimistic")
            return
        if self.is_main:
            checkpoint("before-commit")
            if point == "before-commit":
                os._exit(73)
        if self.is_main and point == "lost-no-commit" and not faulted:
            faulted = True
            raise pymysql.err.OperationalError(1000, "Synthetic lost acknowledgement without commit")
        self.raw.commit()
        if self.is_main:
            checkpoint("after-commit")
            if point == "after-commit":
                os._exit(73)
            if point in {"lost-ack", "changed-owner", "changed-log"} and not faulted:
                faulted = True
                if point in {"changed-owner", "changed-log"}:
                    other = guarded_connect(**native_config)
                    try:
                        with other.cursor() as cursor:
                            if point == "changed-owner":
                                cursor.execute("UPDATE web_taiko_bindings SET source='hiroba' WHERE user_id=%s AND taiko_id=%s", (options["userId"], options["taikoId"]))
                            else:
                                cursor.execute("UPDATE web_data_sync_logs SET result_json='[]' WHERE user_id=%s AND taiko_id=%s", (options["userId"], options["taikoId"]))
                        other.commit()
                    finally:
                        other.close()
                if options.get("changeConfig"):
                    os.environ["TAIKO_DB_NAME"] = "forbidden_new_global_config"
                raise pymysql.err.OperationalError(1000, "Synthetic private lost acknowledgement")
    def rollback(self):
        if options.get("failRollback") and self.is_main:
            raise pymysql.err.OperationalError(1000, "Synthetic failed rollback")
        return self.raw.rollback()
    def close(self):
        if self.raw.open:
            self.raw.close()
        checkpoint("closed")

def guarded_connect(*args, **kwargs):
    global main_connections
    connection = native_connect(*args, **kwargs)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT DATABASE()")
            actual = cursor.fetchone()[0]
            assert actual == expected_database and actual.endswith("_test")
        connection.commit()
    except BaseException:
        connection.close()
        raise
    # The CLI passes its bounded read timeout; the independent real song-lock
    # connection retains its existing options. Both are guarded native SQL.
    is_main = "read_timeout" in kwargs and main_connections == 0
    if "read_timeout" in kwargs:
        main_connections += 1
    return Connection(connection, is_main)
pymysql.connect = guarded_connect

def guard(event, args):
    if event == "socket.connect":
        address = args[1]
        assert isinstance(address, tuple) and address[1] == int(os.environ.get("TAIKO_DB_PORT", "3306"))
        assert address[0] in {os.environ.get("TAIKO_DB_HOST", "127.0.0.1"), "127.0.0.1", "::1"}
    if event in ("open", "os.mkdir", "os.remove", "os.rmdir", "os.rename", "os.link", "os.symlink"):
        values = args[:2] if event in ("os.rename", "os.link", "os.symlink") else args[:1]
        for value in values:
            if not isinstance(value, (str, bytes)):
                continue
            path = Path(os.fsdecode(value)).resolve()
            for blocked in (Path("/home/sigaer/taiko/userdata"), Path("/home/sigaer/taiko-bot/userdata"), Path("/home/sigaer/taiko/secrets"), Path("/etc/taiko-runtime.env"), Path("/home/sigaer/taiko/config.json")):
                assert path != blocked and blocked not in path.parents, "Production private access forbidden"
            mutation = event != "open" or (len(args) > 2 and isinstance(args[2], int) and args[2] & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND))
            if mutation:
                assert path == owned or owned in path.parents or path == Path("/dev/null"), "Mutation outside owned fixture forbidden"
sys.addaudithook(guard)

from taiko_bot.cli import source_mutation_cli as cli
from taiko_bot.runtime.player.center import update_user as update
def synthetic_wahlap(update, identity, payload):
    def response(data):
        return types.SimpleNamespace(status_code=200, json=lambda: json.loads(json.dumps(data)))
    def post(url, **kwargs):
        assert kwargs.get("timeout") == (5, 30), "Actual acquisition HTTP needs bounded timeouts"
        if url.endswith("/all/songs"):
            assert str(kwargs["json"]["userid"]) == identity
            return response({"message": "ok", "data": {"playedRecords": {"scoreInfo": payload.get("songs", [])}}})
        assert url.endswith("/search/player")
        return response({"data": {"players": [payload["profile"]]}})
    def get(url, **kwargs):
        assert kwargs.get("timeout") == (5, 30)
        assert url.endswith("/" + identity)
        return response({"data": payload.get("achievement", {})} if "/achievement/" in url else {"data": []})
    update.requests = types.SimpleNamespace(post=post, get=get)


native_config=cli._db_config()
if options.get("storedCredentials"):
    from taiko_bot.runtime.player.center.hiroba.credentials import encrypt_password
    c=guarded_connect(**{k:v for k,v in native_config.items()})
    try:
        with c.cursor() as cursor:
            cursor.execute("INSERT INTO web_hiroba_credentials(taiko_no,email,password_enc) VALUES (%s,%s,%s)", (options["taikoId"],"synthetic@example.test",encrypt_password("synthetic-password")))
        c.commit()
    finally:c.close()
synthetic_wahlap(update,options["taikoId"],options["payload"])
daily=types.ModuleType("taiko_bot.runtime.player.center.daily_ability")
daily.capture_snapshot=lambda *args,**kwargs: checkpoint("daily-callback")
sys.modules[daily.__name__]=daily
actual_update=update.getUserData
def acquire(identity,*,publication_store=None):
    publication_store._require_lock(write=True)
    checkpoint("acquire");pause("acquire")
    if point=="grant-pinned":os._exit(73)
    if options.get("refreshResult") is not None:return options["refreshResult"]
    result=actual_update(identity,publication_store=publication_store)
    checkpoint("acquired")
    if point=="acquired":os._exit(73)
    return result
update.getUserData=acquire
from taiko_bot.runtime.player.center.hiroba import sync as hsync
from taiko_bot.runtime.player.center.hiroba.parser import HirobaProfile
class RemoteHiroba:
    def __init__(self,token=None,timeout=10):self.token="synthetic-token";self.timeout=timeout
    def login(self,email,password,*,taiko_no=None):
        assert email=="synthetic@example.test" and password=="synthetic-password"
        checkpoint("acquire");pause("acquire")
        if point=="grant-pinned":os._exit(73)
    def update_score(self):pass
    def fetch_mypage(self):return "synthetic-profile-html"
    def fetch_score_list(self,genre):return "synthetic-empty-score-list"
hsync.HirobaClient=RemoteHiroba
hsync.parse_profile=lambda html:HirobaProfile(taiko_no=options.get("resolvedId",options["taikoId"]),nickname="合成用户",title="Synthetic title",region="JP")
hsync.parse_mypage_achievement=lambda html:{}
hsync.parse_score_list_page=lambda html:{}
hsync.time.sleep=lambda seconds:None
from taiko_bot.runtime.player.center import draw_dress as drawing
from PIL import Image
import hashlib
render_inputs=[]
def panel(identity,payload,**kwargs):
    render_inputs.append(payload)
    color=tuple(hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).digest()[:3])+(255,)
    return Image.new("RGBA",(60,100),color)
drawing._render_my_don_base_panel=panel
drawing._render_change_column=lambda **kwargs:Image.new("RGBA",(60,100),(12,34,56,255))
actual_render=drawing.render_update_changes_image
def render(identity,**kwargs):
    view=kwargs["score_view"];assert view.store.identity==str(identity)
    expected=json.loads(view.current_raw())
    image=actual_render(identity,**kwargs)
    assert render_inputs[-1]==expected
    checkpoint("rendered")
    if point=="rendered":os._exit(73)
    return image
drawing.render_update_changes_image=render
if options.get("largeImage"):
    drawing.render_update_changes_image=lambda *args,**kwargs:b"x"*(16*1024**2+1)
if options.get("expireBeforePublish"):
    from taiko_bot.runtime.player.center import source_mutation
    actual_publish=source_mutation.AuthorizedPublicationStore.publish
    fired=[False]
    def publish(store,*args,**kwargs):
        if not fired[0]:
            fired[0]=True
            # Test-controlled credential expiry after network, before any source commit.
            cursor=next_cursor[0]
            cursor.execute("UPDATE web_user_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE user_id=%s",(options["userId"],))
        return actual_publish(store,*args,**kwargs)
    source_mutation.AuthorizedPublicationStore.publish=publish
    next_cursor=[None]
    actual_cursor=Connection.cursor
    def cursor(connection):
        c=actual_cursor(connection)
        if connection.is_main:next_cursor[0]=c
        return c
    Connection.cursor=cursor
cli.main()
