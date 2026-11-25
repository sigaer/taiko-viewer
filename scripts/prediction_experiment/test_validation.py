"""Targeted validation checks; no Bot data, network or external packages."""

import copy
import hashlib
import json
import math
import unittest

from validation import audit_split, deduplicate, make_split, metrics, paired_gain


def row(user="fixture-user-a", chart="fixture-chart-a", family="family-a", **updates):
    result = {
        "user": user, "chart": chart, "family": family, "snapshot": 1,
        "asOf": "2026-10-01T12:00:00Z", "visibleAt": "2026-10-01T11:00:00Z",
        "profileCharts": ["other-chart"], "rating": 12., "six": [0.] * 6,
        "structure": [0.] * 3, "historyCount": 8, "y": 960000., "m0": 950000.,
        "catalogRevision": "catalog-fixture-1", "chartRevision": "chart-fixture-1",
        "point": 950000., "q25": 940000., "q50": 950000., "q75": 960000., "covered": True,
    }
    result.update(updates)
    return result


class SplitTests(unittest.TestCase):
    def setUp(self):
        self.rows = [row(f"fixture-user-{user}", f"fixture-chart-{chart}", f"family-{chart // 2}")
                     for user in range(36) for chart in range(12)]

    def test_latest_snapshot_not_best_score_and_conflict_rejected(self):
        old = row(y=990000.)
        newest = row(snapshot=2, y=900000.)
        self.assertEqual(deduplicate([newest, old]), [newest])
        with self.assertRaisesRegex(ValueError, "conflicting duplicate"):
            deduplicate([row(), row(y=1.)])

    def test_label_independent_grouped_folds_and_full_user_embargo(self):
        changed = [dict(value, y=-value["y"], m0=1.) for value in self.rows]
        signatures = []
        for kind in ("cross-user", "chart-family", "combined"):
            all_tests = []
            tested_user_folds = {}
            for fold in range(3):
                train, test = make_split(self.rows, kind, fold)
                other_train, other_test = make_split(changed, kind, fold)
                signature = lambda values: [(value["user"], value["chart"]) for value in values]
                self.assertEqual(signature(train), signature(other_train))
                self.assertEqual(signature(test), signature(other_test))
                self.assertTrue(train and test)
                self.assertFalse({value["user"] for value in train} & {value["user"] for value in test})
                if kind != "cross-user":
                    self.assertFalse({value["family"] for value in train} & {value["family"] for value in test})
                all_tests.extend(signature(test))
                for value in test:
                    tested_user_folds.setdefault(value["user"], set()).add(fold)
            self.assertEqual(len(all_tests), len(set(all_tests)))
            self.assertTrue(all(len(folds) == 1 for folds in tested_user_folds.values()))
            signatures.append(all_tests)
        self.assertNotEqual(signatures[1], signatures[2])

    def test_all_snapshots_follow_same_user_fold(self):
        extra = [dict(value, snapshot=2) for value in self.rows]
        for fold in range(3):
            train, test = make_split(self.rows + extra, "cross-user", fold)
            self.assertTrue(all(value["snapshot"] == 2 for value in train + test))
            self.assertEqual(len(train) + len(test), len(self.rows))

    def test_three_families_are_balanced_with_exact_preregistered_mapping(self):
        rows = [row(f"fixture-user-{user}", f"chart-{family}", f"family-{family}")
                for user in range(12) for family in range(3)]
        expected_users = sorted(
            {value["user"] for value in rows},
            key=lambda value: hashlib.sha256(f"b43/user/{value}".encode()).digest())
        expected_families = sorted(
            {value["family"] for value in rows},
            key=lambda value: hashlib.sha256(f"b43/family/{value}".encode()).digest())
        for kind in ("cross-user", "chart-family", "combined"):
            for fold in range(3):
                train, test = make_split(rows, kind, fold)
                self.assertTrue(train and test)
                self.assertEqual({value["user"] for value in test}, set(expected_users[fold::3]))
                if kind != "cross-user":
                    family_fold = (fold + 1) % 3 if kind == "combined" else fold
                    self.assertEqual({value["family"] for value in test}, {expected_families[family_fold]})
                    self.assertEqual(len(test), 4)
                    self.assertEqual(len(train), 16)
                self.assertEqual(make_split(list(reversed(rows)), kind, fold), (train, test))

    def test_audit_rejects_each_leakage_and_revision_condition(self):
        cases = [
            ([row()], [row(chart="chart-b")], "held-out user"),
            ([], [row(profileCharts=["fixture-chart-a"])], "target chart"),
            ([], [row(visibleAt="2026-10-02T11:00:00Z")], "future"),
            ([], [row(asOf="2026-10-01T12:00:00")], "timestamp"),
            ([row()], [row(user="b", catalogRevision="other")], "catalog revision"),
            ([row()], [row(user="b", chartRevision="other")], "chart revision"),
            ([], [row(), row()], "duplicate"),
            ([], [row(chartRevision="")], "missing revision"),
        ]
        for train, test, expected in cases:
            with self.subTest(expected=expected), self.assertRaisesRegex(ValueError, expected):
                audit_split(train, test)

    def test_different_charts_can_have_different_revisions(self):
        result = audit_split([row()], [row(user="b", chart="b", chartRevision="b-rev")])
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["heldOutUserOverlap"], 0)


class MetricTests(unittest.TestCase):
    def setUp(self):
        self.rows = [row(user="fixture-user-a", chart="a", y=10., point=8., q25=5., q50=8., q75=9.),
                     row(user="fixture-user-a", chart="b", y=20., point=16., q25=10., q50=16., q75=21.),
                     row(user="fixture-user-b", chart="a", y=30., point=22., q25=20., q50=22., q75=32.)]

    def test_macro_weighted_errors_quantiles_and_intervals(self):
        result = metrics(self.rows)
        weighted, macro = result["recordWeighted"], result["userMacro"]
        self.assertAlmostEqual(weighted["mae"], 14 / 3)
        self.assertAlmostEqual(macro["mae"], 5.5)
        self.assertAlmostEqual(weighted["medianAE"], 4)
        self.assertAlmostEqual(macro["medianAE"], 5.5)
        self.assertAlmostEqual(weighted["rmse"], math.sqrt(84 / 3))
        self.assertAlmostEqual(macro["rmse"], (math.sqrt(10) + 8) / 2)
        self.assertAlmostEqual(weighted["pinballQ25"], 25 / 12)
        self.assertAlmostEqual(weighted["pinballQ50"], 7 / 3)
        self.assertAlmostEqual(weighted["pinballQ75"], .5)
        self.assertAlmostEqual(weighted["intervalCoverage"], 2 / 3)
        self.assertAlmostEqual(weighted["intervalWidth"], 9.)

    def test_ranking_preregistered_threshold_and_tie_break(self):
        rows = [row(chart="a", y=970000., point=990000.),
                row(chart="b", y=900000., point=980000.),
                row(chart="c", y=960000., point=970000.),
                row(chart="d", y=980000., point=960000.)]
        result = metrics(rows)["recordWeighted"]
        self.assertAlmostEqual(result["precisionAtK"], 2 / 3)
        self.assertAlmostEqual(result["recallAtK"], 2 / 3)
        self.assertAlmostEqual(result["ndcgAtK"], 1.5 / (1 + 1 / math.log2(3) + .5))
        zero = metrics([row(y=10.)])["userMacro"]
        self.assertIsNone(zero["recallAtK"])
        self.assertIsNone(zero["ndcgAtK"])

    def test_empty_singleton_and_strata_explicit(self):
        empty = metrics([])
        self.assertIsNone(empty["userMacro"])
        singleton = metrics([row(historyCount=0, covered=False)])
        self.assertIsNone(singleton["mae95CI"]["userMacro"])
        self.assertEqual(singleton["strata"]["history"]["cold"]["insufficient"], "singleton-user")
        self.assertEqual(singleton["strata"]["history"]["sparse"]["insufficient"], "empty")
        self.assertIsNone(singleton["strata"]["cohortCoverage"]["uncovered"]["userMacro"])

    def test_rating_strata_use_preregistered_core_rating_scale(self):
        values = [row(user=f"rating-user-{index}", rating=rating)
                  for index, rating in enumerate((4.9, 5., 7.9, 8., 10.9, 11., 13.9, 14., 15.5))]
        result = metrics(values)["strata"]["rating"]
        self.assertEqual(list(result), ["-inf..5", "5..8", "8..11", "11..14", "14..inf"])
        self.assertEqual([value["records"] for value in result.values()], [1, 2, 2, 2, 2])

    def test_cluster_bootstrap_reproducible_and_no_identifiers(self):
        result = metrics(self.rows, seed=123)
        self.assertEqual(result, metrics(list(reversed(self.rows)), seed=123))
        rendered = json.dumps(result, allow_nan=False)
        self.assertNotIn("fixture-user", rendered)
        self.assertNotIn("fixture-chart", rendered)
        self.assertEqual(result["bootstrapResamples"], 200)
        self.assertEqual(result["mae95CI"]["userMacro"], {"lower": 3., "upper": 8.})

    def test_invalid_quantiles_duplicate_targets_and_nonfinite_rejected(self):
        for values in ([row(q25=970000.)], [row(), row()], [row(point=float("nan"))],
                       [row(q25=None)], [row(q25=None, q50=None)], [row(q25=float("nan"))]):
            with self.assertRaises(ValueError):
                metrics(values)

    def test_unavailable_distribution_preserves_point_metrics_and_explicit_counts(self):
        no_distribution = [dict(value, q25=None, q50=None, q75=None) for value in self.rows]
        result = metrics(no_distribution)
        self.assertEqual(result["distributionRecords"], 0)
        self.assertEqual(result["distributionDistinctPlayers"], 0)
        self.assertAlmostEqual(result["recordWeighted"]["mae"], 14 / 3)
        self.assertAlmostEqual(result["userMacro"]["mae"], 5.5)
        for summary in ("recordWeighted", "userMacro"):
            for metric in ("pinballQ25", "pinballQ50", "pinballQ75", "intervalCoverage", "intervalWidth"):
                self.assertIsNone(result[summary][metric])
        mixed = metrics(no_distribution[:1] + self.rows[1:])
        self.assertEqual(mixed["distributionRecords"], 2)
        self.assertEqual(mixed["distributionDistinctPlayers"], 2)
        self.assertAlmostEqual(mixed["recordWeighted"]["mae"], 14 / 3)
        self.assertAlmostEqual(mixed["recordWeighted"]["pinballQ25"], 2.5)
        self.assertAlmostEqual(mixed["recordWeighted"]["intervalCoverage"], 1.)
        self.assertEqual(mixed["strata"]["history"]["established"]["distributionRecords"], 2)

    def test_paired_gain_same_users_resampled_and_immutable_targets(self):
        hybrid = [dict(value, point=value["y"]) for value in self.rows]
        result = paired_gain(self.rows, hybrid)
        self.assertAlmostEqual(result["userMacroGain"], 5.5)
        self.assertAlmostEqual(result["recordWeightedGain"], 14 / 3)
        self.assertEqual(result["gain95CI"]["userMacro"], {"lower": 3., "upper": 8.})
        self.assertEqual(result, paired_gain(list(reversed(self.rows)), list(reversed(hybrid))))
        self.assertNotIn("fixture-user", json.dumps(result))
        with self.assertRaisesRegex(ValueError, "same evaluable"):
            paired_gain(self.rows, hybrid[:-1])
        for field, value in (("y", 1.), ("snapshot", 2), ("chartRevision", "new")):
            corrupted = copy.deepcopy(hybrid)
            corrupted[0][field] = value
            with self.assertRaisesRegex(ValueError, "identical target"):
                paired_gain(self.rows, corrupted)
        self.assertIsNone(paired_gain(self.rows[:1], hybrid[:1])["gain95CI"]["userMacro"])


if __name__ == "__main__":
    unittest.main()
