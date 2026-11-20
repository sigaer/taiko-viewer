"""Resolve explicit song names and official title variants without fuzzy guesses."""
from __future__ import annotations

import html
import re
import unicodedata
from collections import defaultdict


def name_key(value):
    return song_name_key(value).casefold()


def song_name_key(value):
    text = unicodedata.normalize("NFKC", html.unescape(str(value or "")))
    return " ".join(text.translate(str.maketrans({"’": "'", "‘": "'"})).split())


# Reviewed against the actual catalog and existing local title details on 2026-11-20.
# These are explicit translations/upstream spellings, not punctuation-stripped fuzzy keys.
REVIEWED_SONG_ALIASES = {
    "古典乐组曲（寒假篇）": "クラシックメドレー（冬休み編）",
    "DAJARE de OSHARE": "ダジャレdeオシャレ",
    "YELL EX MAKINA!": "YELL EX MACHINA!",
    "GO GET'EM": "GO GET'EM!",
    "Nesin Amatias": "【限定】 Nesin Amatias",
    "よくでる15300": "【限定】 よくでる15300",
    "黄ダルマ2000": "【限定】 黄ダルマ2000",
    "ココドコ？多分ドッカ島": "ココドコ？多分ドッカ島！",
}

# Both arcade IDs are intentionally associated in the reviewed title source.
# An unlisted third ID or changed Japanese name invalidates this disambiguation.
REVIEWED_ARCADE_GROUPS = {
    "ヘイラ": frozenset({1146, 1264}),
    "いっそこのままで": frozenset({939, 1263}),
    "ボクハシンセ": frozenset({191, 1266}),
    "濃紅": frozenset({450, 1257}),
}


class SongMatcher:
    def __init__(self, songs):
        self.exact = defaultdict(set)
        self.folded = defaultdict(set)
        self.songs = {}
        for song in songs:
            song_id = positive_id(song.get("id"))
            if song_id is None:
                raise ValueError("Invalid song catalog ID")
            self.songs[song_id] = song
            for field in ("song_name", "song_name_jp"):
                key = song_name_key(song.get(field))
                if key and key != "-":
                    self.exact[key].add(song_id)
                    self.folded[key.casefold()].add(song_id)
        self.aliases = {name_key(alias): canonical for alias, canonical in REVIEWED_SONG_ALIASES.items()}

    def lookup(self, name):
        key = song_name_key(name)
        if self.exact.get(key):
            return self.exact[key], "exact"
        return self.folded.get(key.casefold(), set()), "casefold"

    def resolve(self, name, difficulty):
        candidates, method = self.lookup(name)
        alias_names = [name]
        if not candidates and difficulty in {"inner_oni", "oni_or_inner_oni"}:
            stripped = re.sub(r"\s*\((?:裏|裏譜面|里|里谱)\)$", "", song_name_key(name))
            alias_names.append(stripped)
            candidates, method = self.lookup(stripped)
            if candidates:
                method = "chart_suffix"
        if not candidates:
            for alias in alias_names:
                if canonical := self.aliases.get(name_key(alias)):
                    candidates, _ = self.lookup(canonical)
                    method = "reviewed_alias"
                    break
        if len(candidates) > 1:
            arcade = {
                sid for sid in candidates
                if positive_id(self.songs[sid].get("nijiiro_id")) == sid
                and self.songs[sid].get("shelf_status") in {0, 1}
            }
            if arcade:
                candidates = arcade
                method = "arcade_catalog"
        if len(candidates) == 1:
            return sorted(candidates), "matched", method
        if len(candidates) > 1:
            for japanese_name, group in REVIEWED_ARCADE_GROUPS.items():
                if candidates == group and all(
                    song_name_key(self.songs[sid].get("song_name_jp")) == song_name_key(japanese_name)
                    and positive_id(self.songs[sid].get("nijiiro_id")) == sid
                    and self.songs[sid].get("shelf_status") in {0, 1}
                    for sid in candidates
                ):
                    return sorted(candidates), "matched", "reviewed_arcade_group"
            return [], "ambiguous", "ambiguous"
        return [], "unmatched", "unmatched"


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
    matcher = SongMatcher(songs)

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
        row["song_ids"], row["song_match"], row["song_match_method"] = matcher.resolve(row["song_name"], row["difficulty_scope"])
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
