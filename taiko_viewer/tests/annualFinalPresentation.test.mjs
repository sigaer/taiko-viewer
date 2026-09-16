import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { createI18n } from "vue-i18n";

register("./support/nuxtAliasHooks.mjs", import.meta.url);
const { normalizeAnnualSummary } = await import("../utils/annualSummary.ts");
const messages = Object.fromEntries(await Promise.all(["zh", "ja"].map(async (locale) => [
  locale, JSON.parse(await readFile(new URL(`../locales/${locale}.json`, import.meta.url), "utf8"))
])));
const base = {
  schemaVersion: 4, summaryId: "annual_presentation_fixture", generatedAt: "2026-09-16T09:00:00",
  mode: "version_observed", version: {}, coverage: {}, profileCard: {}, period: {}, sections: {},
  overview: { status: "observed", data: { playCount: 100 } },
  finalTitle: { titleKey: "final_growth", evidenceKey: "growth_breakthrough", evidenceValue: { milestones: 1 }, strongDan: false, standingPresentation: null }
};
const standing = { danId: 19, mark: 6, family: "gold_rainbow", titleKey: "standing_19_gold_rainbow", evidenceText: "DO NOT DISPLAY CANONICAL TEXT", provenance: "current_version" };
const normalize = (locale, patch = {}) => {
  const input = structuredClone({ ...base, ...patch, finalTitle: { ...base.finalTitle, ...patch.finalTitle } });
  const before = structuredClone(input);
  const calls = [];
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages });
  const result = normalizeAnnualSummary(input, locale, (key, params) => { calls.push(key); return i18n.global.t(key, params || {}); });
  assert.deepEqual(input, before, "normalization must not rewrite generator semantics");
  return { result, calls };
};

for (const locale of ["zh", "ja"]) {
  test(`${locale}: event evidence cannot override ordinary title/body`, () => {
    for (const evidenceKey of ["dan_gold_pass", "dan_kanzui_gold", "dan_kanzui_red", "dan_fullgood_gold", "dan_fullgood_red", "dan_major_progress"]) {
      for (const strongDan of [false, true]) {
        const { result } = normalize(locale, { finalTitle: { evidenceKey, evidenceValue: { danBefore: 6, dan: 14, mark: 2 }, strongDan } });
        assert.equal(result.finalTitle.title, messages[locale].annualSummary.finalTitles.final_growth.title);
        assert.equal(result.finalTitle.narrativeBody, messages[locale].annualSummary.finalTitles.final_growth.body);
        assert.equal(Boolean(result.finalTitle.standing), false);
      }
    }
    const { result } = normalize(locale, { finalTitle: { standingPresentation: standing, strongDan: false } });
    assert.equal(result.finalTitle.title, messages[locale].annualSummary.finalTitles.final_growth.title);
  });

  test(`${locale}: grade evidence reads dan, preserves real zero and rejects missing numbers`, () => {
    for (const danBefore of [0, 6]) {
      const { result } = normalize(locale, { finalTitle: { evidenceKey: "dan_major_progress", evidenceValue: { danBefore, dan: 13, danAfter: 0 } } });
      const before = danBefore === 0 ? "0" : "初段";
      assert.equal(result.finalTitle.evidenceText, `${before} → 八段（${locale === "ja" ? "年間" : "年内"} +${13 - danBefore} 段）`);
    }
    for (const field of ["danBefore", "dan"]) {
      for (const invalid of [undefined, null, "", " ", false, NaN, Infinity, -1, 20, 1.5]) {
        const { result } = normalize(locale, { finalTitle: { evidenceKey: "dan_major_progress", evidenceValue: { danBefore: 6, dan: 13, [field]: invalid } } });
        assert.equal(result.finalTitle.evidenceText.includes("→"), false, `${field}=${invalid}`);
      }
    }
  });

  test(`${locale}: no breakthrough never resolves a nonexistent encouragement narrative`, () => {
    for (const sections of [{}, { breakthrough: { status: "unavailable", data: null } }]) {
      const { result, calls } = normalize(locale, { sections });
      assert.equal(result.breakthrough.title, "");
      assert.equal(result.breakthrough.body, "");
      assert.equal(calls.some((key) => key.startsWith("annualSummary.breakthroughTitles.")), false);
    }
  });

  test(`${locale}: all 24 standing buckets use localized dan/mark evidence`, () => {
    let count = 0;
    for (const [danId, families] of Object.entries(messages[locale].annualSummary.danPresentation.standing)) {
      for (const [family, copy] of Object.entries(families)) {
        const mark = { red: 1, red_rainbow: 3, gold: 4, gold_rainbow: 6 }[family];
        const payload = { ...standing, danId: Number(danId), mark, family, titleKey: `standing_${danId}_${family}` };
        const { result } = normalize(locale, { finalTitle: { strongDan: true, standingPresentation: payload } });
        assert.equal(result.finalTitle.title, copy.title);
        assert.equal(result.finalTitle.narrativeBody, copy.body);
        assert.equal(result.finalTitle.standing, true);
        assert.equal(result.finalTitle.evidenceText.endsWith(` · ${messages[locale].annualSummary.standingCompletion[mark]}`), true);
        assert.equal(result.finalTitle.evidenceText.includes("CANONICAL"), false);
        count++;
      }
    }
    assert.equal(count, 24);
    const { result } = normalize(locale, { finalTitle: { strongDan: true, standingPresentation: standing } });
    assert.equal(result.finalTitle.evidenceText, locale === "zh" ? "达人 · 金虹合格" : "達人 · 金合格全良");
    for (const mark of [null, undefined, 0, 7]) {
      const { result } = normalize(locale, { finalTitle: { strongDan: true, standingPresentation: { ...standing, mark } } });
      assert.equal(Boolean(result.finalTitle.standing), false);
      assert.equal(result.finalTitle.title, messages[locale].annualSummary.finalTitles.final_growth.title);
    }
  });
}
