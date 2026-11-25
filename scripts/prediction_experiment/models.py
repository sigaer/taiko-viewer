"""Synthetic-only comparison models; no IO, production defaults or fitted test labels.

M0 is the immutable Bot point supplied by the fixture, not an approximation.
All fitted scales, residuals and calibration labels come from training users.
"""
from __future__ import annotations

import hashlib
import math
import statistics

MATCHINGS = ('rating', 'six', 'structure')
BUDGETS = ('top10', 'top24', 'top40', 'top60', 'adaptive')
MODELS = ('M0', 'M1', 'M2', 'M3', 'M4')
CALIBRATION_USERS = 24  # fixed before inspecting experiment outcomes
MIN_DISTINCT_PLAYERS = 5
MIN_EFFECTIVE_SAMPLE_SIZE = 5.0


def quantile(values, probability):
    values = sorted(values)
    if not values:
        return 0.0
    position = (len(values) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def _features(row, matching):
    # Six/structure augment Rating; they never replace the shared Rating axis.
    return ([float(row['rating'])] + (list(row['six']) if matching in ('six', 'structure') else [])
            + (list(row['structure']) if matching == 'structure' else []))


def _latest(rows):
    output = {}
    for row in rows:
        key = (row['user'], row['chart'])
        if key not in output or row['snapshot'] > output[key]['snapshot']:
            output[key] = row
    return list(output.values())


def _mean(values, weights):
    total = sum(weights)
    return sum(value * weight for value, weight in zip(values, weights)) / total


def _ess(weights):
    return sum(weights) ** 2 / sum(weight ** 2 for weight in weights) if weights else 0.0


def _supported(pool):
    return pool is not None and pool['count'] >= MIN_DISTINCT_PLAYERS and pool['ess'] >= MIN_EFFECTIVE_SAMPLE_SIZE


class _Fit:
    def __init__(self, train, matching, budget):
        self.rows = _latest([row for row in train if row.get('m0') is not None])
        self.matching, self.budget = matching, budget
        self._group_cache = {}
        self._neighbor_cache = {}
        columns = list(zip(*[_features(row, matching) for row in self.rows]))
        self.scales = [max(statistics.pstdev(column), 1e-6) for column in columns]
        residuals = [row['y'] - row['m0'] for row in self.rows]
        # Robust residual noise is a scale, not an outcome-tuned blend coefficient.
        self.noise = max((quantile(residuals, .75) - quantile(residuals, .25)) / 1.349, 1000.0)

    def _neighbors(self, query, scope, kernel):
        query_features = _features(query, self.matching)
        group_key = (scope, query['chart'] if scope == 'chart' else query['family'] if scope == 'family' else None, query['asOf'])
        neighbor_key = (group_key, query['user'], tuple(query_features), kernel)
        if neighbor_key in self._neighbor_cache:
            return self._neighbor_cache[neighbor_key]
        if group_key not in self._group_cache:
            groups = {}
            for row in self.rows:
                if row['visibleAt'] > query['asOf']:
                    continue
                if scope == 'chart' and row['chart'] != query['chart']:
                    continue
                if scope == 'family' and row['family'] != query['family']:
                    continue
                # User is the sampling unit at every hierarchy level. Multiple
                # charts do not buy a high-frequency player extra weight.
                groups.setdefault(row['user'], []).append(row)
            self._group_cache[group_key] = [
                (user, [statistics.mean(column) for column in zip(*[_features(row, self.matching) for row in records])],
                 statistics.mean(row['y'] for row in records), statistics.mean(row['y'] - row['m0'] for row in records))
                for user, records in groups.items()]
        peers = []
        for user, features, score, residual in self._group_cache[group_key]:
            if user == query['user']:
                continue
            distance = math.sqrt(sum(((left - right) / scale) ** 2 for left, right, scale in zip(query_features, features, self.scales)) / max(len(query_features), 1))
            peers.append((distance, str(user), score, residual))
        peers.sort(key=lambda item: (item[0], item[1]))
        limit = min(60, len(peers)) if self.budget == 'adaptive' else int(self.budget[3:])
        chosen = peers[:limit]
        if not chosen:
            return None
        # The 24th neighbor is a train-only local bandwidth. At least one
        # standardized unit avoids a singular kernel for identical Ratings.
        bandwidth = max(chosen[min(23, len(chosen) - 1)][0], 1.0)
        weights = [math.exp(-.5 * (item[0] / bandwidth) ** 2) if kernel else 1.0 for item in chosen]
        if self.budget == 'adaptive':
            # Smallest train-derived prefix reaching ESS 24; cap at 60 distinct users.
            for length in range(min(10, len(chosen)), len(chosen) + 1):
                if _ess(weights[:length]) >= 24:
                    chosen, weights = chosen[:length], weights[:length]
                    break
        scores, residuals = [item[2] for item in chosen], [item[3] for item in chosen]
        mean_residual = _mean(residuals, weights)
        result = {'score': _mean(scores, weights), 'residual': mean_residual,
                  'variance': _mean([(value - mean_residual) ** 2 for value in residuals], weights),
                  'count': len(chosen), 'ess': _ess(weights)}
        self._neighbor_cache[neighbor_key] = result
        return result

    def point(self, query, model):
        baseline = float(query['m0'])
        target = self._neighbors(query, 'chart', model != 'M1')
        metadata = {'covered': _supported(target), 'distinctPlayerCount': target['count'] if target else 0,
                    'effectiveSampleSize': target['ess'] if target else 0.0,
                    'fallback': None, 'residualShrinkage': 0.0, 'hierarchy': 'chart' if _supported(target) else 'none'}
        if model == 'M0':
            return baseline, metadata
        if model in ('M1', 'M2'):
            if not _supported(target):
                metadata['fallback'] = 'personal:insufficient-target-cohort'
                return baseline, metadata
            return target['score'], metadata
        family = self._neighbors(query, 'family', True)
        global_pool = self._neighbors(query, 'global', True)
        target = target if _supported(target) else None
        family = family if _supported(family) else None
        global_pool = global_pool if _supported(global_pool) else None
        if target is None and family is None:
            metadata['fallback'] = 'personal:insufficient-chart-and-family-cohort'
            return baseline, metadata
        # Hierarchy is train-only: global -> family -> chart. ESS controls
        # precision, while 12 equivalent users is a preregistered weak prior.
        value_key = 'residual' if model == 'M4' else 'score'
        prior = global_pool[value_key] if global_pool else (family or target)[value_key]
        estimate = prior
        if family:
            family_weight = family['ess'] / (family['ess'] + 12.0)
            estimate = family_weight * family[value_key] + (1 - family_weight) * prior
        local = target or family
        if target:
            chart_weight = target['ess'] / (target['ess'] + 12.0)
            estimate = chart_weight * target[value_key] + (1 - chart_weight) * estimate
        else:
            metadata['hierarchy'] = 'family'
        if model == 'M3':
            return estimate, metadata
        # Posterior signal precision: high conditional variance / small ESS
        # suppresses the correction. No fixed 50/50 or heldout tuning.
        standard_error_squared = local['variance'] / max(local['ess'], 1.0)
        shrinkage = local['ess'] / (local['ess'] + 12.0) * self.noise ** 2 / (self.noise ** 2 + standard_error_squared)
        metadata['residualShrinkage'] = shrinkage
        return baseline + shrinkage * estimate, metadata


def _calibration(train, matching, budget, model):
    users = sorted({row['user'] for row in train}, key=lambda user: hashlib.sha256(str(user).encode()).hexdigest())[:CALIBRATION_USERS]
    errors = []
    for user in users:
        # Refit ALL statistics without the calibration user: conditional residuals,
        # feature scales, uncertainty and hierarchy have genuine user OOF provenance.
        fit = _Fit([row for row in train if row['user'] != user], matching, budget)
        records = _latest([row for row in train if row['user'] == user and row.get('m0') is not None])
        for row in records:
            point, _ = fit.point(row, model)
            errors.append(row['y'] - point)
    return [quantile(errors, probability) for probability in (.25, .5, .75)], len(errors), len(users)


def predict(train, test, model, matching='rating', budget='top24'):
    """Return internal predictions. Caller must aggregate before writing artifacts."""
    if model not in MODELS or matching not in MATCHINGS or budget not in BUDGETS:
        raise ValueError('unknown model, matching or sample budget')
    train_users = {row['user'] for row in train}
    if train_users.intersection(row['user'] for row in test):
        raise ValueError('heldout user appears in training')
    # A single fit uses the earliest prediction cutoff. This conservative rule
    # also prevents future rows influencing scales or residual calibration.
    cutoff = min((row['asOf'] for row in test), default='')
    eligible_train = [row for row in train if row['visibleAt'] <= cutoff]
    fit = _Fit(eligible_train, matching, budget)
    offsets, count, users = _calibration(eligible_train, matching, budget, model)
    result = []
    for row in _latest(test):
        if row.get('m0') is None:
            continue  # identical baseline-evaluable set for every model
        point, metadata = fit.point(row, model)
        output = dict(row, point=point, q25=point + offsets[0], q50=point + offsets[1], q75=point + offsets[2], **metadata)
        output['calibration'] = {'method': 'train-user-oof-residual-quantiles/1', 'records': count, 'users': users,
                                 'heldoutLabelsUsed': False, 'personalPointUnmodified': model == 'M0'}
        result.append(output)
    return result
