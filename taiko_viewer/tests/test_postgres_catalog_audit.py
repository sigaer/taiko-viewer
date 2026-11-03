"""Identity, difficulty semantics, and read-only admission for catalog audits."""

import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "postgres_catalog_audit", Path(__file__).resolve().parents[1] / "scripts/audit_postgres_catalog.py"
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def chart(pg_id=999, nijiiro_id=1, title="曲名", difficulties=None):
    return {
        "id": pg_id, "nijiiro_id": nijiiro_id, "title": title,
        "title_translations": {"ja": title}, "bpm": 180, "category_flags": 1,
        "status": "published", "difficulties": difficulties or [],
        "resources": {"tja_reference": True, "tja_record": True, "audio_reference": True, "audio_record": True},
    }


def snapshot(charts):
    return {"charts": charts, "difficulty_rows": sum(len(c["difficulties"]) for c in charts)}


def song(**overrides):
    return {"id": 1, "song_name": "曲名", "song_name_jp": "曲名", "bpm": "180",
            "type": "南梦宫原创音乐", **overrides}


class CatalogAuditTest(unittest.TestCase):
    def test_matches_nijiiro_id_instead_of_internal_primary_key(self):
        report = audit.compare_catalog([song()], snapshot([chart(), chart(pg_id=1, nijiiro_id=2, title="別の曲")]))
        self.assertEqual(report["matches"][0]["pg_id"], 999)
        self.assertEqual(report["summary"]["issue_counts"], {})

    def test_title_candidate_does_not_silently_map_a_missing_id(self):
        report = audit.compare_catalog([song()], snapshot([chart(nijiiro_id=None)]))
        self.assertEqual(report["summary"]["matched_by_nijiiro_id"], 0)
        self.assertEqual(report["summary"]["unmatched_with_exact_title_candidates"], 1)

    def test_duplicate_source_ids_are_never_arbitrarily_selected(self):
        report = audit.compare_catalog([song()], snapshot([chart(), chart(pg_id=1000)]))
        self.assertEqual(report["matches"], [])
        self.assertEqual(report["summary"]["issue_counts"]["pg_duplicate_nijiiro_id"], 1)

    def test_two_player_courses_and_zero_level_do_not_create_false_differences(self):
        difficulties = [
            {"course": "Oni", "side": "single", "level": 9},
            {"course": "Oni", "side": "p1", "level": 10},
            {"course": "Edit", "side": "p2", "level": 10},
        ]
        report = audit.compare_catalog([song(level_4=9, level_5=0)], snapshot([chart(difficulties=difficulties)]))
        self.assertEqual(report["summary"]["single_courses_compared"], 1)
        self.assertEqual(report["issues"], [])

    def test_range_bpm_is_uncomparable_and_conflicting_title_is_reported(self):
        report = audit.compare_catalog([song(bpm="180-360", level_4=9)], snapshot([chart(title="違う曲", difficulties=[
            {"course": "Oni", "side": "single", "level": 8},
        ])]))
        codes = report["summary"]["issue_counts"]
        self.assertEqual(codes["bpm_not_scalar_comparable"], 1)
        self.assertEqual(codes["level_difference"], 1)
        self.assertEqual(codes["id_matched_title_unconfirmed"], 1)
        self.assertNotIn("bpm_difference", codes)

    def test_reports_missing_current_songs_separately_from_other_catalogs(self):
        report = audit.compare_catalog([song(), song(id=2, shelf_status=2)], snapshot([]))
        self.assertEqual(report["summary"]["unmatched_by_shelf_status"], {"0": 1, "2": 1})

    def test_read_only_guard_rejects_write_capable_or_unbounded_snapshot(self):
        data = snapshot([])
        data["connection"] = {
            "role": "reader", "transaction_read_only": "on", "superuser": False,
            "table_privileges": [{"table": table, "select": True, "write": False} for table in audit.REQUIRED_TABLES],
        }
        audit.validate_snapshot(data, "reader")
        data["connection"]["table_privileges"][0]["write"] = True
        with self.assertRaises(ValueError):
            audit.validate_snapshot(data, "reader")
        data["connection"]["table_privileges"][0]["write"] = False
        data["difficulty_rows"] = audit.MAX_DIFFICULTIES + 1
        with self.assertRaises(ValueError):
            audit.validate_snapshot(data, "reader")

    def test_reader_role_cannot_inject_sql(self):
        with self.assertRaises(ValueError):
            audit.catalog_sql('reader"; RESET ROLE; --')


if __name__ == "__main__":
    unittest.main()
