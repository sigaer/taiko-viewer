"""Catalog matching and real HTTP synchronization using synthetic catalog rows."""
import copy
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import sys
import subprocess
import tempfile
import threading
import unittest
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from extract_title_song_relations import build_relations, detect_difficulty, detect_requirement_type
from title_relation_ids import enrich_relations, SongMatcher
from sync_title_song_relations import TitleAPI, apply_plan, build_plan


def relation(song="New Song", **extra):
    return dict(song_name=song, title_name="New Title", requirement_type="full_combo",
                difficulty_scope="oni", condition_text="全连", source_row_index=1, **extra)


def title(uid=101, name="New Title", rarity=42, subtitle=""):
    return dict(uid=uid, name=name, rarity=rarity, subtitle=subtitle, subtitle_got="")


def resolved(rows=None, songs=None, catalog=None):
    return enrich_relations(rows or [relation()], songs or [dict(id=1511, song_name="New Song")],
                            catalog or [title()], detect_requirement_type, detect_difficulty)


def payload(bindings):
    return dict(schema_version=2, title_bindings=bindings)


class MatchingTests(unittest.TestCase):
    def test_condition_song_names_preserve_punctuation_and_commas(self):
        names = ["B.B.K.K.B.K.K.", "R.I.", "UFO Swingin'", "敬启，我在学校...", "I am not Alice."]
        for index, name in enumerate(names, 1):
            with self.subTest(name=name):
                api = {"titles": [title(subtitle=f"在《{name}》的“魔王”难度下达成全连吧")]}
                result = build_relations({"rows": []}, api, [{"id": index, "song_name": name}])
                self.assertEqual(result["relations"][0]["song_name"], name)
                self.assertEqual(result["relations"][0]["song_ids"], [index])

    def test_case_distinct_song_uses_exact_spelling_first(self):
        matcher = SongMatcher([{"id": 930, "song_name": "ALiVE"}, {"id": 1143, "song_name": "ALIVE"}])
        self.assertEqual(matcher.resolve("ALiVE", "oni")[0], [930])
        self.assertEqual(matcher.resolve("ALIVE", "oni")[0], [1143])
        self.assertEqual(matcher.resolve("alive", "oni")[1], "ambiguous")

    def test_reviewed_translations_and_upstream_spellings(self):
        pairs = [("古典乐组曲（寒假篇）", "クラシックメドレー（冬休み編）"),
                 ("DAJARE de OSHARE", "ダジャレdeオシャレ"),
                 ("YELL EX MAKINA!", "YELL EX MACHINA!"),
                 ("GO GET'EM", "GO GET’EM！"),
                 ("Nesin Amatias", "【限定】 Nesin Amatias")]
        for alias, canonical in pairs:
            with self.subTest(alias=alias):
                self.assertEqual(SongMatcher([{"id": 7, "song_name": canonical}]).resolve(alias, "oni"),
                                 ([7], "matched", "reviewed_alias"))

    def test_alias_target_must_actually_exist_and_be_unambiguous(self):
        self.assertEqual(SongMatcher([{"id": 7, "song_name": "Other"}]).resolve("DAJARE de OSHARE", "oni")[1], "unmatched")
        matcher = SongMatcher([{"id": 7, "song_name": "ダジャレdeオシャレ"}, {"id": 8, "song_name": "ダジャレdeオシャレ"}])
        self.assertEqual(matcher.resolve("DAJARE de OSHARE", "oni")[1], "ambiguous")

    def test_chart_suffix_can_compose_with_reviewed_alias(self):
        matcher = SongMatcher([{"id": 1309, "song_name_jp": "ココドコ？多分ドッカ島！"}])
        self.assertEqual(matcher.resolve("ココドコ？多分ドッカ島(裏)", "inner_oni"),
                         ([1309], "matched", "reviewed_alias"))
        self.assertEqual(matcher.resolve("ココドコ？多分ドッカ島(裏)", "oni")[1], "unmatched")

    def test_song_name_does_not_supply_difficulty_connector(self):
        self.assertEqual(detect_difficulty('在《KOKODOKO? 或许是DOKKA岛呢!》的“魔王（隐藏）”难度下达成全连吧'), "inner_oni")
        self.assertEqual(detect_difficulty('在《Song》的魔王或魔王（隐藏）难度下达成全连吧'), "oni_or_inner_oni")

    def test_arcade_identity_separates_other_platform_song(self):
        matcher = SongMatcher([{"id": 264, "nijiiro_id": 264, "shelf_status": 0, "song_name": "Mecha DESU."},
                               {"id": 100472, "shelf_status": 2, "song_name": "Mecha DESU."}])
        self.assertEqual(matcher.resolve("Mecha DESU.", "inner_oni"), ([264], "matched", "arcade_catalog"))

    def test_reviewed_arcade_id_group_can_retain_both_ids(self):
        songs = [{"id": sid, "nijiiro_id": sid, "shelf_status": 0, "song_name": "Hater", "song_name_jp": "ヘイラ"}
                 for sid in (1146, 1264)]
        rows, bindings = resolved([relation("Hater")], songs=songs)
        self.assertEqual(rows[0]["song_ids"], [1146, 1264])
        self.assertEqual(rows[0]["song_match_method"], "reviewed_arcade_group")
        self.assertTrue(bindings[0]["complete"])
        self.assertEqual(build_plan(payload(bindings), [])["changes"][0]["after"], [1146, 1264])

    def test_reviewed_group_rejects_third_arcade_id_or_changed_japanese_name(self):
        songs = [{"id": sid, "nijiiro_id": sid, "shelf_status": 0, "song_name": "Hater", "song_name_jp": "ヘイラ"}
                 for sid in (1146, 1264)]
        extra = {"id": 1500, "nijiiro_id": 1500, "shelf_status": 0, "song_name": "Hater", "song_name_jp": "ヘイラ"}
        self.assertEqual(SongMatcher(songs + [extra]).resolve("Hater", "oni")[1], "ambiguous")
        songs[1]["song_name_jp"] = "Different composition"
        self.assertEqual(SongMatcher(songs).resolve("Hater", "oni")[1], "ambiguous")

    def test_generic_option_and_series_conditions_do_not_create_fake_songs(self):
        conditions = [f'1プレイ中全曲でオプション「{option}」を付けてクリア'
                      for option in ("あべこべ", "きまぐれ", "さんばい", "でたらめ", "ばいそく", "よんばい", "ドロン")]
        conditions += ["IA曲をクリア", "GUMI曲をクリア", "公式の初音ミク曲をクリア", "東方Projectアレンジ楽曲をクリア",
                       "1プレイ内全て特定の曲(アイドルマスターの楽曲)を選んでクリア", "在１次游玩中以“全连”通关所有曲目吧"]
        for condition in conditions:
            with self.subTest(condition=condition):
                wiki = {"rows": [{"cells": [{"html": "0"}, {"html": "New Title"}, {"html": condition}]}]}
                result = build_relations(wiki, {"titles": [title(subtitle=condition)]}, [{"id": 7, "song_name": "Other"}])
                self.assertEqual(result["relations"], [])
                self.assertEqual(result["title_bindings"], [])

    def test_failed_generation_preserves_last_good_file(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("QA_RUN_TMPDIR", "/var/tmp")) as directory:
            root = Path(directory)
            for name, value in {"wiki": {"rows": []}, "titles": {"titles": [title(-1)]},
                                "songs": [{"id": 1, "song_name": "New Song"}]}.items():
                (root / name).write_text(json.dumps(value))
            output = root / "relations"
            output.write_text("last good generation")
            script = Path(__file__).resolve().parents[1] / "scripts/extract_title_song_relations.py"
            result = subprocess.run([sys.executable, str(script), "--input", str(root / "wiki"),
                                     "--output", str(output), "--title-catalog", str(root / "titles"),
                                     "--songs", str(root / "songs")], capture_output=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(output.read_text(), "last good generation")

    def test_no_title_placeholder_is_not_a_song_title_binding(self):
        _, bindings = resolved(catalog=[title(0, name="（不使用称号）", rarity=0), title()])
        self.assertEqual([b["official_title_id"] for b in bindings], [101])

    def test_unicode_and_id_namespaces(self):
        rows, bindings = resolved([relation("Ｎｅｗ　Ｓｏｎｇ")])
        self.assertEqual(rows[0]["song_ids"], [1511])
        self.assertEqual(rows[0]["title_ids"], [101])
        self.assertEqual(bindings[0]["official_title_id"], 101)

    def test_ambiguous_names_never_guess_or_publish(self):
        rows, bindings = resolved(songs=[dict(id=1, song_name="New Song"), dict(id=2, song_name="New Song")])
        self.assertEqual(rows[0]["song_ids"], [])
        self.assertEqual(rows[0]["song_match"], "ambiguous")
        self.assertFalse(bindings[0]["complete"])
        self.assertEqual(build_plan(payload(bindings), [])["changes"], [])

    def test_duplicate_official_identity_does_not_publish(self):
        _, bindings = resolved([relation(source_title_id=101)], catalog=[title(101), title(102)])
        self.assertFalse(bindings[0]["complete"])
        self.assertEqual(build_plan(payload(bindings), [])["changes"], [])

    def test_inner_suffix_and_plate_variants(self):
        rows, bindings = resolved([relation("New Song(裏)", source_title_id=103) | {"difficulty_scope": "inner_oni"}],
                                  catalog=[title(101), title(102, rarity=43), title(103, rarity=60)])
        self.assertEqual(rows[0]["song_ids"], [1511])
        self.assertEqual(rows[0]["title_ids"], [103])
        self.assertEqual([b["rarity"] for b in bindings], [60])

    def test_wiki_does_not_mix_clear_fc_ap_or_omote_ura(self):
        rows, _ = resolved(catalog=[title(101), title(102, rarity=41), title(103, rarity=43), title(104, rarity=60)])
        self.assertEqual(rows[0]["title_ids"], [101])

    def test_missing_song_does_not_partially_publish_multisong_title(self):
        rows, bindings = resolved([relation(), relation("Unknown")])
        self.assertEqual(rows[1]["song_match"], "unmatched")
        self.assertFalse(bindings[0]["complete"])
        self.assertEqual(build_plan(payload(bindings), [])["changes"], [])

    def test_generation_keeps_legacy_indexes_and_adds_ids(self):
        api = dict(titles=[title(subtitle="在《New Song》的“魔王”难度下达成全连吧")])
        result = build_relations(dict(rows=[]), api, [dict(id=1511, song_name="New Song")])
        self.assertEqual(result["relations"][0]["song_ids"], [1511])
        self.assertEqual(result["by_song"]["New Song"][0]["title_ids"], [101])
        self.assertEqual(result["by_title"]["New Title"][0]["song_ids"], [1511])
        self.assertEqual(result["by_song_id"]["1511"][0]["title_name"], "New Title")
        self.assertEqual(result["stats"]["complete_title_bindings_total"], 1)

    def test_plan_preserves_manual_ids_and_uses_local_id(self):
        _, bindings = resolved()
        local = [dict(id=7, name="New Title", rarity=42, condition="Manual", songIds=[99])]
        original = copy.deepcopy(local)
        change = build_plan(payload(bindings), local)["changes"][0]
        self.assertEqual(change["local_id"], 7)
        self.assertEqual(change["after"], [99, 1511])
        self.assertEqual(local, original)
        self.assertEqual(build_plan(payload(bindings), local + copy.deepcopy(local))["changes"], [])

    def test_title_identity_matches_viewer_case_and_width_rules(self):
        _, bindings = resolved()
        lower_case = [dict(id=7, name="new title", rarity=42, songIds=[99])]
        # Viewer does not merge a differently cased local title into this official row.
        self.assertEqual(build_plan(payload(bindings), lower_case)["changes"][0]["action"], "add")
        full_width = [dict(id=7, name="Ｎｅｗ　Ｔｉｔｌｅ", rarity=42, songIds=[99])]
        self.assertEqual(build_plan(payload(bindings), full_width)["changes"][0]["local_id"], 7)


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.rows = [dict(id=7, name="New Title", rarity=42, condition="Manual", songIds=[99])]
        self.requests = []
        self.fail_update = False
        self.repeat_pages = False
        self.ignore_write = False
        self.duplicate_add = False
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def handle_request(self):
                parsed = urlsplit(self.path)
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"]))) if self.headers.get("Content-Length") else None
                outer.requests.append((self.command, parsed.path, body))
                data, status, code = None, 200, 0
                if parsed.path == "/taiko/title/page":
                    page = int(parse_qs(parsed.query)["page"][0])
                    start = 0 if outer.repeat_pages else page - 1
                    data = dict(total=len(outer.rows), pageData=outer.rows[start:start + 1])
                elif parsed.path == "/taiko/login":
                    data = "synthetic-test-token"
                elif parsed.path == "/taiko/manage/auth/me":
                    data = dict(id=1)
                elif parsed.path == "/taiko/title/get":
                    data = next(row for row in outer.rows if row["id"] == int(parse_qs(parsed.query)["id"][0]))
                elif self.headers.get("Authorization") != "Bearer synthetic-test-token":
                    status, code = 401, 1
                elif parsed.path.endswith("/update"):
                    if outer.fail_update:
                        code = 1
                    elif not outer.ignore_write:
                        next(row for row in outer.rows if row["id"] == body["id"]).update(body)
                elif parsed.path.endswith("/add"):
                    outer.rows.append(dict(body, id=70 + len(outer.rows)))
                    if outer.duplicate_add:
                        outer.rows.append(dict(body, id=70 + len(outer.rows)))
                else:
                    status, code = 404, 1
                raw = json.dumps(dict(code=code, data=data)).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            do_GET = do_POST = do_PUT = handle_request

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.server.timeout = 3
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.api = TitleAPI(f"http://127.0.0.1:{self.server.server_port}")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.assertFalse(self.thread.is_alive())

    def test_authenticated_update_add_readback_and_idempotent_rerun(self):
        _, bindings = resolved()
        bindings.append(dict(official_title_id=999, title_name="Other Title", rarity=60,
                             condition="API condition", song_ids=[2], complete=True))
        source = payload(bindings)
        plan = build_plan(source, self.api.list_titles())
        self.assertFalse(any(method != "GET" for method, _, _ in self.requests))
        self.api.authenticate(dict(username="synthetic", password="synthetic"))
        # A manual addition made after planning is merged during the fresh GET.
        self.rows[0]["songIds"].append(88)
        result = apply_plan(self.api, source, plan)
        self.assertEqual(result, dict(updated=1, added=1, skipped=0, verified=True))
        self.assertEqual(self.rows[0]["songIds"], [88, 99, 1511])
        self.assertEqual(self.rows[0]["condition"], "Manual")
        self.assertEqual(build_plan(source, self.api.list_titles())["changes"], [])
        update = next(body for method, path, body in self.requests if method == "PUT")
        self.assertEqual(set(update), {"id", "songIds"})
        self.assertEqual(update["id"], 7)
        addition = next(body for method, path, body in self.requests if path.endswith("/add"))
        self.assertNotIn("id", addition)

    def test_error_stops_mutations_without_retry(self):
        _, bindings = resolved()
        self.api.token = "synthetic-test-token"
        self.fail_update = True
        with self.assertRaises(RuntimeError):
            apply_plan(self.api, payload(bindings), build_plan(payload(bindings), self.api.list_titles()))
        self.assertEqual(sum(method == "PUT" for method, _, _ in self.requests), 1)
        self.assertEqual(self.rows[0]["songIds"], [99])

    def test_success_response_without_persisted_change_fails_readback(self):
        _, bindings = resolved()
        self.api.token = "synthetic-test-token"
        self.ignore_write = True
        with self.assertRaisesRegex(RuntimeError, "read-back"):
            apply_plan(self.api, payload(bindings), build_plan(payload(bindings), self.api.list_titles()))

    def test_duplicate_row_after_addition_fails_readback(self):
        _, bindings = resolved(catalog=[title(name="Other Title")], rows=[relation() | {"title_name": "Other Title"}])
        self.api.token = "synthetic-test-token"
        self.duplicate_add = True
        with self.assertRaisesRegex(RuntimeError, "read-back"):
            apply_plan(self.api, payload(bindings), build_plan(payload(bindings), self.api.list_titles()))

    def test_repeated_or_incomplete_pages_fail_before_writes(self):
        self.rows.append(dict(id=8, name="Another", rarity=2, songIds=[]))
        self.repeat_pages = True
        with self.assertRaisesRegex(ValueError, "repeated"):
            self.api.list_titles()
        self.assertTrue(all(method == "GET" for method, _, _ in self.requests))


if __name__ == "__main__":
    unittest.main()
