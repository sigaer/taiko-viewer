"""Resolve explicit song names and official title variants without fuzzy guesses."""
from __future__ import annotations

import html
import re
import unicodedata
from collections import defaultdict


def name_key(value):
    return " ".join(unicodedata.normalize("NFKC", html.unescape(str(value or ""))).split()).casefold()


def title_name_key(value):
    # Match Viewer titleDetails.ts exactly; case belongs to the official title.
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split())


def positive_id(value):
    if isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (ValueError, TypeError):
        return None
    return number if number > 0 and str(number) == str(value) else None


PLATE_SCOPES = {
    41: ("clear", "oni"), 42: ("full_combo", "oni"), 43: ("all_perfect", "oni"),
    59: ("clear", "inner_oni"), 60: ("full_combo", "inner_oni"), 61: ("all_perfect", "inner_oni"),
}


def enrich_relations(relations, songs, catalog, detect_requirement, detect_difficulty):
    lookup = defaultdict(set)
    for song in songs:
        song_id = positive_id(song.get("id"))
        if song_id is None:
            raise ValueError("Invalid song catalog ID")
        for field in ("song_name", "song_name_jp"):
            key = name_key(song.get(field))
            if key and key != "-":
                lookup[key].add(song_id)

    titles = {}
    by_name = defaultdict(list)
    for title in catalog:
        if title.get("id", title.get("uid")) == 0 and title.get("name") == "（不使用称号）":
            continue
        title_id = positive_id(title.get("id", title.get("uid")))
        if title_id is None or not str(title.get("name") or "").strip():
            raise ValueError("Invalid official title identity")
        if title_id in titles:
            raise ValueError("Repeated official title ID")
        rarity = int(title["rarity"])
        condition = str(title.get("subtitle") or "").strip()
        if re.fullmatch(r"[?？\s]*", condition):
            condition = ""
        requirement, difficulty = PLATE_SCOPES.get(rarity, (None, "unspecified"))
        requirement = requirement or detect_requirement(condition) or detect_requirement(title.get("subtitle_got", ""))
        if difficulty == "unspecified":
            difficulty = detect_difficulty(condition)
        titles[title_id] = {
            "official_title_id": title_id, "title_name": str(title["name"]).strip(),
            "rarity": rarity, "condition": condition,
            "song_ids": [], "complete": True,
        }
        by_name[title_name_key(title["name"])].append((title_id, requirement, difficulty))

    used_titles = set()
    identities = defaultdict(int)
    for binding in titles.values():
        identities[(title_name_key(binding["title_name"]), binding["rarity"])] += 1
    for binding in titles.values():
        if identities[(title_name_key(binding["title_name"]), binding["rarity"])] > 1:
            binding["complete"] = False
    enriched = []
    for original in relations:
        row = dict(original)
        key = name_key(row["song_name"])
        candidates = lookup.get(key, set())
        # A wiki link may include the chart-side suffix; it is not part of the song name.
        if not candidates and row["difficulty_scope"] in {"inner_oni", "oni_or_inner_oni"}:
            stripped = re.sub(r"\s*\((?:裏|裏譜面|里|里谱)\)$", "", key)
            candidates = lookup.get(stripped, set())
        row["song_ids"] = sorted(candidates) if len(candidates) == 1 else []
        row["song_match"] = "matched" if len(candidates) == 1 else "ambiguous" if candidates else "unmatched"
        row["title_ids"] = []
        for title_id, requirement, difficulty in by_name.get(title_name_key(row["title_name"]), []):
            source_title_id = positive_id(row.get("source_title_id"))
            if source_title_id is not None and title_id != source_title_id:
                continue
            if requirement and requirement != row["requirement_type"]:
                continue
            scope = row["difficulty_scope"]
            if difficulty != "unspecified" and scope != "unspecified" and difficulty != scope:
                if scope != "oni_or_inner_oni" or difficulty not in {"oni", "inner_oni"}:
                    continue
            row["title_ids"].append(title_id)
            used_titles.add(title_id)
            binding = titles[title_id]
            binding["song_ids"] = sorted(set(binding["song_ids"]) | set(row["song_ids"]))
            if row["song_match"] != "matched":
                binding["complete"] = False
        row["title_ids"].sort()
        row.pop("source_title_id", None)
        enriched.append(row)
    return enriched, [titles[key] for key in sorted(used_titles)]
