"""Focused new model isolation tests. Lead runs through the shared QA wrapper."""
import copy
import unittest

from models import BUDGETS, MATCHINGS, MODELS, _Fit, _features, predict


def row(user, chart='chart-a', family='family-a', y=980000, m0=950000, rating=10000, snapshot=1):
    return {'user': user, 'chart': chart, 'family': family, 'snapshot': snapshot,
            'asOf': '2026-01-01T00:00:00Z', 'visibleAt': '2025-12-01T00:00:00Z',
            'profileCharts': ['history-chart'], 'rating': rating,
            'six': [1, 2, 3, 4, 5, 6], 'structure': [2, 3, 4], 'historyCount': 10,
            'y': y, 'm0': m0, 'catalogRevision': 'catalog-fixture/1', 'chartRevision': f'{chart}/1'}


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.train = [row(f'train-{index}', rating=9500 + 100 * index, y=960000 + 500 * index) for index in range(30)]
        self.test = [row('test-user', y=990000)]

    def test_m0_point_is_immutable_and_stable_pb_are_not_quantiles(self):
        predictions = predict(self.train, self.test, 'M0')
        self.assertEqual(predictions[0]['point'], self.test[0]['m0'])
        self.assertEqual(predictions[0]['calibration']['method'], 'train-user-oof-residual-quantiles/1')
        self.assertNotEqual(predictions[0]['q50'], self.test[0]['m0'])

    def test_heldout_labels_do_not_change_any_prediction_or_calibration(self):
        changed = copy.deepcopy(self.test)
        changed[0]['y'] = -99999999
        for model in MODELS:
            before, after = predict(self.train, self.test, model)[0], predict(self.train, changed, model)[0]
            for field in ('point', 'q25', 'q50', 'q75', 'calibration', 'residualShrinkage'):
                self.assertEqual(before[field], after[field], (model, field))

    def test_user_embargo_is_enforced(self):
        with self.assertRaisesRegex(ValueError, 'heldout user'):
            predict(self.train, [row('train-0')], 'M4')

    def test_duplicate_snapshots_never_buy_neighbors_or_ess(self):
        repeated = self.train + [dict(self.train[0], snapshot=0)] * 20
        for model in ('M1', 'M2', 'M3', 'M4'):
            before, after = predict(self.train, self.test, model)[0], predict(repeated, self.test, model)[0]
            for field in ('point', 'distinctPlayerCount', 'effectiveSampleSize'):
                self.assertEqual(before[field], after[field])
            self.assertLessEqual(after['effectiveSampleSize'], after['distinctPlayerCount'] + 1e-9)

    def test_sparse_hierarchy_and_empty_family_fallback(self):
        unseen = [dict(self.test[0], chart='unseen', family='unseen-family')]
        for model in ('M1', 'M2', 'M3', 'M4'):
            output = predict(self.train, unseen, model)[0]
            self.assertEqual(output['point'], output['m0'])
            self.assertFalse(output['covered'])
            self.assertIsNotNone(output['fallback'])
        sibling = [dict(self.test[0], chart='sibling')]
        output = predict(self.train, sibling, 'M4')[0]
        self.assertEqual(output['hierarchy'], 'family')
        self.assertFalse(output['covered'])

    def test_tiny_cohort_falls_back_instead_of_implying_sufficient_evidence(self):
        for count in (1, 4):
            for model in ('M1', 'M2', 'M3', 'M4'):
                output = predict(self.train[:count], self.test, model)[0]
                self.assertEqual(output['point'], output['m0'], (count, model))
                self.assertEqual(output['distinctPlayerCount'], count)
                self.assertFalse(output['covered'])
                self.assertIsNotNone(output['fallback'])
        # Five observations can still have insufficient effective sample size.
        fit = _Fit(self.train[:5], 'rating', 'top24')
        query = self.test[0]
        fit._neighbors = lambda query, scope, kernel: {'score': 1000000, 'residual': 50000,
                                                      'variance': 1000000, 'count': 5, 'ess': 4.99}
        for model in ('M1', 'M2', 'M3', 'M4'):
            point, metadata = fit.point(query, model)
            self.assertEqual(point, query['m0'])
            self.assertIsNotNone(metadata['fallback'])

    def test_fallback_reuses_complete_personal_distribution(self):
        unseen = [dict(self.test[0], chart='unseen', family='unseen-family')]
        personal = predict(self.train, unseen, 'M0')[0]
        for model in ('M1', 'M2', 'M3', 'M4'):
            output = predict(self.train, unseen, model)[0]
            for field in ('point', 'q25', 'q50', 'q75'):
                self.assertEqual(output[field], personal[field], (model, field))
            self.assertEqual(output['calibration']['sourceModel'], 'M0')
            self.assertTrue(output['calibration']['method'].startswith('personal-fallback/'))

    def test_cold_personal_unavailable_has_shared_evaluable_set(self):
        test = self.test + [row('cold-user', m0=None)]
        for model in MODELS:
            self.assertEqual([item['user'] for item in predict(self.train, test, model)], ['test-user'])

    def test_residual_correction_is_conditional_shrunk_and_not_fixed_half(self):
        output = predict(self.train, self.test, 'M4')[0]
        self.assertGreater(output['residualShrinkage'], 0)
        self.assertLess(output['residualShrinkage'], 1)
        self.assertNotAlmostEqual(output['residualShrinkage'], .5)
        self.assertGreater(output['point'], output['m0'])

    def test_user_oof_refits_without_entire_user(self):
        # A one-player training pool cannot learn its own residual during OOF:
        # every calibration point must fall back to immutable personal prediction.
        train = [row('only-user', y=1000000), row('only-user', chart='chart-b', y=900000)]
        output = predict(train, self.test, 'M4')[0]
        self.assertEqual(output['calibration']['users'], 1)
        self.assertEqual(output['q25'] - output['point'], -25000)
        self.assertEqual(output['q50'] - output['point'], 0)
        self.assertEqual(output['q75'] - output['point'], 25000)

    def test_train_only_scales_and_all_budget_variants(self):
        self.assertEqual(_features(self.test[0], 'structure'), [10000., 1, 2, 3, 4, 5, 6, 2, 3, 4])
        fit = _Fit(self.train, 'rating', 'top24')
        expected = fit.scales[:]
        self.test[0]['rating'] = 1000000
        self.assertEqual(fit.scales, expected)
        for matching in MATCHINGS:
            for budget in BUDGETS:
                output = predict(self.train, self.test, 'M2', matching, budget)[0]
                self.assertLessEqual(output['distinctPlayerCount'], 60)
                self.assertLessEqual(output['q25'], output['q50'])
                self.assertLessEqual(output['q50'], output['q75'])

    def test_future_visible_observations_are_not_neighbors(self):
        future = [dict(item, visibleAt='2027-01-01T00:00:00Z') for item in self.train]
        output = predict(future, self.test, 'M4')[0]
        self.assertEqual(output['point'], output['m0'])
        self.assertEqual(output['distinctPlayerCount'], 0)
        self.assertFalse(output['calibration']['available'])
        self.assertEqual([output['q25'], output['q50'], output['q75']], [None, None, None])

    def test_no_training_calibration_is_unavailable_for_every_model(self):
        for model in MODELS:
            output = predict([], self.test, model)[0]
            self.assertEqual(output['point'], output['m0'])
            self.assertEqual([output['q25'], output['q50'], output['q75']], [None, None, None])
            self.assertFalse(output['calibration']['available'])


if __name__ == '__main__':
    unittest.main()
