"""Outcome-independent splits, leakage checks and aggregate synthetic evaluation.

Only the experiment process holds row identities. Public return values never contain
user IDs, chart-level outcomes or individual predictions.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import hashlib
import math
import random
import statistics


OBSERVED_BEST_SCORE_THRESHOLD = 950_000.0
RATING_BOUNDS = (5_000.0, 10_000.0, 15_000.0, 20_000.0)


def _fold(value, folds, namespace):
    digest = hashlib.sha256(f"b43/{namespace}/{value}".encode()).digest()
    return int.from_bytes(digest[:8], "big") % folds


def _identity(row):
    return str(row["user"]), str(row["chart"])


def _time(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps require an explicit timezone")
    return parsed


def deduplicate(rows):
    """Keep the latest snapshot per player/chart, never selecting by score.

    Snapshot sequence has priority, followed by asOf. A repeated snapshot with
    conflicting content is rejected rather than letting input order pick a label.
    """
    latest = {}
    for row in rows:
        key = _identity(row)
        order = (int(row["snapshot"]), _time(row["asOf"]))
        previous = latest.get(key)
        if previous is None or order > previous[0]:
            latest[key] = (order, row)
        elif order == previous[0] and row != previous[1]:
            raise ValueError("conflicting duplicate snapshot")
    return [latest[key][1] for key in sorted(latest)]


def make_split(rows, kind, fold, folds=3):
    """Build reproducible, label-blind splits after latest-snapshot deduplication.

    All protocols rotate held-out user folds. chart-family holds out family fold
    ``fold``; combined holds out family fold ``(fold + 1) % folds``. The explicit
    family permutation makes their test panels distinct while preserving the
    strict user embargo and assigning every user's snapshots to only one test
    fold. Both protocols therefore measure joint user/family exclusion, rather
    than independent types of generalization. Testing all users on a held-out
    family would leave no training users in a dense fixture. Do not pool these
    protocols as though their test cases matched or their evidence independent.
    """
    if kind not in {"cross-user", "chart-family", "combined"}:
        raise ValueError("unknown split kind")
    if folds < 2 or fold not in range(folds):
        raise ValueError("invalid fold")
    rows = deduplicate(rows)
    users = {row["user"] for row in rows if _fold(row["user"], folds, "user") == fold}
    family_fold = (fold + 1) % folds if kind == "combined" else fold
    held_families = {
        row["family"] for row in rows
        if _fold(row["family"], folds, "family") == family_fold
    }
    test = [row for row in rows if row["user"] in users and (
        kind == "cross-user" or row["family"] in held_families
    )]
    # Embargo the complete predetermined user fold, not merely users with a target
    # in this fold. Every held-out user's other charts remain excluded too.
    train = [row for row in rows if row["user"] not in users and (
        kind == "cross-user" or row["family"] not in held_families
    )]
    audit_split(train, test)
    return train, test


def audit_split(train, test):
    """Fail closed on overlap, target/future features or inconsistent revisions.

    chartRevision is fixed per canonical chart, while catalogRevision is fixed
    across the experiment. Different charts may legitimately have different
    chart revisions. Counts are safe to publish; identifiers never leave here.
    """
    violations = []
    train_users = {row["user"] for row in train}
    test_users = {row["user"] for row in test}
    if train_users & test_users:
        violations.append("held-out user appears in training")
    revisions = defaultdict(set)
    families = defaultdict(set)
    catalogs = set()
    for part, rows in (("train", train), ("test", test)):
        identities = [_identity(row) for row in rows]
        if len(identities) != len(set(identities)):
            violations.append(f"{part}: duplicate user/chart snapshots")
        for row in rows:
            if row["chart"] in row["profileCharts"]:
                violations.append(f"{part}: target chart appears in profile")
            try:
                if _time(row["visibleAt"]) > _time(row["asOf"]):
                    violations.append(f"{part}: future profile visibility")
            except (TypeError, ValueError):
                violations.append(f"{part}: invalid timestamp")
            if not row.get("catalogRevision") or not row.get("chartRevision"):
                violations.append(f"{part}: missing revision")
            catalogs.add(row.get("catalogRevision"))
            revisions[row["chart"]].add(row.get("chartRevision"))
            families[row["chart"]].add(row["family"])
    if len(catalogs) > 1:
        violations.append("catalog revision mismatch")
    if any(len(values) > 1 for values in revisions.values()):
        violations.append("chart revision mismatch")
    if any(len(values) > 1 for values in families.values()):
        violations.append("chart family identity mismatch")
    report = {
        "trainRecords": len(train), "testRecords": len(test),
        "trainDistinctPlayers": len(train_users), "testDistinctPlayers": len(test_users),
        "trainFamilies": len({row["family"] for row in train}),
        "testFamilies": len({row["family"] for row in test}),
        "heldOutUserOverlap": len(train_users & test_users),
        "catalogRevisionCount": len(catalogs), "violations": sorted(set(violations)),
    }
    if violations:
        raise ValueError("split audit failed: " + "; ".join(report["violations"]))
    return report


def _mean(values):
    values = [value for value in values if value is not None]
    return statistics.fmean(values) if values else None


def _quantile(values, q):
    ordered = sorted(values)
    if not ordered:
        return None
    index = (len(ordered) - 1) * q
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] * (high - index) + ordered[high] * (index - low) if high != low else ordered[low]


def _pinball(y, prediction, q):
    difference = y - prediction
    return max(q * difference, (q - 1) * difference)


def _ranking(rows, k):
    # Chart identity is a deterministic tie breaker independent of observed y.
    ranked = sorted(rows, key=lambda row: (-row["point"], str(row["chart"])))
    selected = ranked[:k]
    relevant = sum(row["y"] >= OBSERVED_BEST_SCORE_THRESHOLD for row in rows)
    hits = sum(row["y"] >= OBSERVED_BEST_SCORE_THRESHOLD for row in selected)
    dcg = sum((row["y"] >= OBSERVED_BEST_SCORE_THRESHOLD) / math.log2(index + 2)
              for index, row in enumerate(selected))
    ideal = sum(1 / math.log2(index + 2) for index in range(min(relevant, len(selected))))
    return {
        "precisionAtK": hits / len(selected) if selected else None,
        "recallAtK": hits / relevant if relevant else None,
        "ndcgAtK": dcg / ideal if ideal else None,
    }


def _record_metrics(rows):
    if not rows:
        return None
    absolute = [abs(row["point"] - row["y"]) for row in rows]
    return {
        "mae": statistics.fmean(absolute),
        "medianAE": statistics.median(absolute),
        "rmse": math.sqrt(statistics.fmean((row["point"] - row["y"]) ** 2 for row in rows)),
        "pinballQ25": statistics.fmean(_pinball(row["y"], row["q25"], .25) for row in rows),
        "pinballQ50": statistics.fmean(_pinball(row["y"], row["q50"], .50) for row in rows),
        "pinballQ75": statistics.fmean(_pinball(row["y"], row["q75"], .75) for row in rows),
        "intervalCoverage": statistics.fmean(row["q25"] <= row["y"] <= row["q75"] for row in rows),
        "intervalWidth": statistics.fmean(row["q75"] - row["q25"] for row in rows),
    }


def _summarize(rows, k):
    if not rows:
        return {"recordWeighted": None, "userMacro": None}
    users = defaultdict(list)
    for row in rows:
        users[row["user"]].append(row)
    per_user = [_record_metrics(group) | _ranking(group, k) for group in users.values()]
    macro = {key: _mean(user[key] for user in per_user) for key in per_user[0]}
    weighted = _record_metrics(rows)
    for key in ("precisionAtK", "recallAtK", "ndcgAtK"):
        eligible = [(user[key], len(group)) for user, group in zip(per_user, users.values()) if user[key] is not None]
        weighted[key] = sum(value * count for value, count in eligible) / sum(count for _, count in eligible) if eligible else None
    return {"recordWeighted": weighted, "userMacro": macro}


def _interval(values):
    return {"lower": _quantile(values, .025), "upper": _quantile(values, .975)}


def _bootstrap(rows, bootstrap, seed):
    users = defaultdict(list)
    for row in rows:
        users[row["user"]].append(abs(row["point"] - row["y"]))
    if len(users) < 2 or bootstrap < 2:
        return {"userMacro": None, "recordWeighted": None, "reason": "fewer-than-two-users-or-resamples"}
    clusters = [(sum(errors), len(errors)) for _, errors in sorted(users.items())]
    rng = random.Random(seed)
    macro, weighted = [], []
    for _ in range(bootstrap):
        sample = rng.choices(clusters, k=len(clusters))
        macro.append(statistics.fmean(total / count for total, count in sample))
        weighted.append(sum(total for total, _ in sample) / sum(count for _, count in sample))
    return {"userMacro": _interval(macro), "recordWeighted": _interval(weighted), "reason": None}


def _stratum(rows, k, bootstrap, seed):
    count = len({row["user"] for row in rows})
    return {
        "records": len(rows), "distinctPlayers": count,
        **(_summarize(rows, k) if count >= 2 else {"recordWeighted": None, "userMacro": None}),
        "mae95CI": _bootstrap(rows, bootstrap, seed),
        "insufficient": None if count >= 2 else "empty" if not count else "singleton-user",
    }


def _validate_predictions(rows):
    identities = [_identity(row) for row in rows]
    if len(identities) != len(set(identities)):
        raise ValueError("predictions must contain one snapshot per user/chart")
    for row in rows:
        if any(not isinstance(row.get(key), (int, float)) or not math.isfinite(row[key])
               for key in ("y", "point", "q25", "q50", "q75", "rating")):
            raise ValueError("predictions require finite numeric values")
        if not row["q25"] <= row["q50"] <= row["q75"]:
            raise ValueError("prediction quantiles are not ordered")


def metrics(predictions, k=3, bootstrap=200, seed=4301):
    """Common evaluable-set metrics for the observed best-score snapshot target.

    Ranking relevance is preregistered at score >=950000; rates never describe
    next-attempt success. Macro averages user-level metrics (including each user's
    median and RMSE); recordWeighted computes record-level error metrics, with
    user ranking metrics weighted by that user's record count. Users without a
    relevant chart have null recall/NDCG and do not enter those means. Intervals
    are nominal 50% Q25..Q75. Bootstrap samples whole user clusters 200 times.
    """
    if k < 1 or bootstrap < 0:
        raise ValueError("invalid metric settings")
    rows = list(predictions)
    _validate_predictions(rows)
    strata = {"rating": {}, "history": {}, "cohortCoverage": {}}
    bounds = (float("-inf"),) + RATING_BOUNDS + (float("inf"),)
    for low, high in zip(bounds, bounds[1:]):
        label = f"{int(low) if math.isfinite(low) else '-inf'}..{int(high) if math.isfinite(high) else 'inf'}"
        strata["rating"][label] = _stratum([row for row in rows if low <= row["rating"] < high], k, bootstrap, seed)
    for label, predicate in (
        ("cold", lambda row: row["historyCount"] == 0),
        ("sparse", lambda row: 0 < row["historyCount"] < 5),
        ("established", lambda row: row["historyCount"] >= 5),
    ):
        strata["history"][label] = _stratum([row for row in rows if predicate(row)], k, bootstrap, seed)
    for covered in (False, True):
        strata["cohortCoverage"]["covered" if covered else "uncovered"] = _stratum(
            [row for row in rows if bool(row["covered"]) == covered], k, bootstrap, seed)
    return {
        "records": len(rows), "distinctPlayers": len({row["user"] for row in rows}),
        "target": "observed-best-score-snapshot", "rankingK": k,
        "rankingRelevantScoreAtLeast": OBSERVED_BEST_SCORE_THRESHOLD,
        "intervalNominalCoverage": .5, "bootstrapResamples": bootstrap,
        **_summarize(rows, k), "mae95CI": _bootstrap(rows, bootstrap, seed), "strata": strata,
    }


def paired_gain(m0_predictions, m4_predictions, bootstrap=200, seed=4301):
    """Paired cluster bootstrap; positive numbers mean lower M4 absolute error.

    Both models must cover exactly the same immutable targets. Each bootstrap
    draw resamples the same users for both models; it never resamples records as
    independent observations or fits anything to held-out outcomes.
    """
    if bootstrap < 0:
        raise ValueError("invalid bootstrap count")
    m0, m4 = list(m0_predictions), list(m4_predictions)
    _validate_predictions(m0)
    _validate_predictions(m4)
    left, right = {_identity(row): row for row in m0}, {_identity(row): row for row in m4}
    if left.keys() != right.keys():
        raise ValueError("paired models require the same evaluable targets")
    users = defaultdict(list)
    for key in sorted(left):
        before, after = left[key], right[key]
        for field in ("y", "snapshot", "catalogRevision", "chartRevision", "asOf"):
            if before[field] != after[field]:
                raise ValueError("paired models require identical target revisions and labels")
        users[before["user"]].append(abs(before["point"] - before["y"]) - abs(after["point"] - after["y"]))
    clusters = [(sum(gains), len(gains)) for _, gains in sorted(users.items())]
    macro = statistics.fmean(total / count for total, count in clusters) if clusters else None
    weighted = sum(total for total, _ in clusters) / sum(count for _, count in clusters) if clusters else None
    intervals = {"userMacro": None, "recordWeighted": None}
    if len(clusters) >= 2 and bootstrap >= 2:
        rng = random.Random(seed)
        sampled_macro, sampled_weighted = [], []
        for _ in range(bootstrap):
            sample = rng.choices(clusters, k=len(clusters))
            sampled_macro.append(statistics.fmean(total / count for total, count in sample))
            sampled_weighted.append(sum(total for total, _ in sample) / sum(count for _, count in sample))
        intervals = {"userMacro": _interval(sampled_macro), "recordWeighted": _interval(sampled_weighted)}
    return {
        "records": len(m0), "distinctPlayers": len(users), "positiveMeans": "M4-lower-MAE",
        "userMacroGain": macro, "recordWeightedGain": weighted,
        "gain95CI": intervals, "bootstrapResamples": bootstrap,
        "insufficient": None if len(users) >= 2 and bootstrap >= 2 else "fewer-than-two-users-or-resamples",
    }
