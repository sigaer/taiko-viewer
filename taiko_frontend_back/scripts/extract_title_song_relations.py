#!/usr/bin/env python3
"""Extract song-title relations from title_wikitable.json.

This script focuses on title rows whose conditions are song-specific clear/full combo
requirements and outputs a reusable JSON mapping.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ANCHOR_RE = re.compile(r"<a\s+([^>]*?)>(.*?)</a>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
ATTR_RE = re.compile(
    r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*\'([^\']*)\''
)

GENERIC_PHRASES = (
    "一局内",
    "所有曲子",
    "全部选择",
    "系列",
    "专辑",
    "选项",
    "双人模式",
    "同时",
    "歌曲",
)


@dataclass
class Anchor:
    href: str
    title: str
    text: str


def parse_attrs(raw: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in ATTR_RE.finditer(raw):
        if match.group(1):
            attrs[match.group(1).lower()] = match.group(2)
        elif match.group(3):
            attrs[match.group(3).lower()] = match.group(4)
    return attrs


def html_to_text(value: str) -> str:
    text = TAG_RE.sub("", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_anchors(value: str) -> list[Anchor]:
    anchors: list[Anchor] = []
    for match in ANCHOR_RE.finditer(value):
        attrs = parse_attrs(match.group(1))
        anchors.append(
            Anchor(
                href=attrs.get("href", "").strip(),
                title=html.unescape(attrs.get("title", "").strip()),
                text=html_to_text(match.group(2)),
            )
        )
    return anchors


def is_song_anchor(anchor: Anchor) -> bool:
    href = anchor.href
    if not href.startswith("http"):
        return False
    if "/taiko/" not in href:
        return False
    if "index.php?title=" in href:
        return False
    title = anchor.title
    if "页面不存在" in title:
        return False
    return bool(anchor.text or title)


def detect_requirement_type(condition_text: str) -> str | None:
    if "全连" in condition_text or "フルコンボ" in condition_text:
        return "full_combo"
    if "过关" in condition_text or "クリア" in condition_text:
        return "clear"
    return None


def detect_difficulty(condition_text: str) -> str:
    if "（里）" in condition_text or "里谱" in condition_text:
        return "inner_oni"
    if "魔王" in condition_text:
        return "oni"
    if "困难" in condition_text:
        return "hard"
    if "普通" in condition_text:
        return "normal"
    if "简单" in condition_text:
        return "easy"
    return "unspecified"


def cleanup_song_name(name: str) -> str:
    value = html.unescape(name).strip()
    value = re.sub(r"\s+", " ", value)
    value = value.strip(" \t\r\n.,，。:：;；\"'()（）[]【】")
    return value


def split_song_blob(blob: str) -> list[str]:
    value = blob
    value = value.replace("以及", "|").replace("和", "|").replace("及", "|").replace("与", "|")
    value = value.replace("、", "|").replace(",", "|").replace("，", "|").replace("/", "|")
    parts = [cleanup_song_name(part) for part in value.split("|")]
    return [part for part in parts if part]


def is_generic_candidate(name: str) -> bool:
    return any(phrase in name for phrase in GENERIC_PHRASES)


def extract_plain_song_names(condition_text: str, requirement_type: str) -> list[str]:
    names: list[str] = []

    if requirement_type == "full_combo":
        # Patterns like: "全连魔王难度的てんぢく2000"
        for match in re.finditer(r"全连[^的]{0,24}的([^，。,；;]+)", condition_text):
            names.extend(split_song_blob(match.group(1)))

        # Patterns like: "将魔王难度的A、B、C全连"
        for match in re.finditer(r"的(.+?)全连", condition_text):
            names.extend(split_song_blob(match.group(1)))

        # Patterns like: "全连チェインクロニクル 最終決戦メドレー"
        match = re.search(r"全连\s*([^，。,；;]+)$", condition_text)
        if match:
            names.extend(split_song_blob(match.group(1)))

    if requirement_type == "clear":
        # Patterns like: "DIMENSIONS过关"
        for match in re.finditer(r"([^，。,；;]+?)过关", condition_text):
            names.extend(split_song_blob(match.group(1)))

    cleaned = []
    for name in names:
        song = cleanup_song_name(name)
        if not song:
            continue
        if is_generic_candidate(song):
            continue
        cleaned.append(song)
    return cleaned


def unique_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def build_relations(payload: dict[str, Any]) -> dict[str, Any]:
    rows = payload.get("rows", [])
    relations: list[dict[str, Any]] = []

    for row_index, row in enumerate(rows):
        cells = row.get("cells", [])
        if len(cells) < 3:
            continue
        title_name = html_to_text(cells[1].get("html", ""))
        condition_html = cells[2].get("html", "")
        condition_text = html_to_text(condition_html)
        if not title_name or not condition_text:
            continue

        requirement_type = detect_requirement_type(condition_text)
        if requirement_type is None:
            continue

        song_names: list[str] = []
        anchors = [a for a in extract_anchors(condition_html) if is_song_anchor(a)]
        if anchors:
            for anchor in anchors:
                primary = cleanup_song_name(anchor.title) if anchor.title else ""
                fallback = cleanup_song_name(anchor.text)
                selected = primary or fallback
                if selected and not is_generic_candidate(selected):
                    song_names.append(selected)
        else:
            song_names.extend(extract_plain_song_names(condition_text, requirement_type))

        song_names = unique_keep_order(song_names)
        if not song_names:
            continue

        difficulty = detect_difficulty(condition_text)
        for song_name in song_names:
            relations.append(
                {
                    "song_name": song_name,
                    "title_name": title_name,
                    "requirement_type": requirement_type,
                    "difficulty_scope": difficulty,
                    "condition_text": condition_text,
                    "source_row_index": row_index,
                }
            )

    deduped: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, str, str]] = set()
    for item in relations:
        key = (
            item["song_name"],
            item["title_name"],
            item["requirement_type"],
            item["condition_text"],
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(item)

    by_song: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_title: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in deduped:
        by_song[item["song_name"]].append(
            {
                "title_name": item["title_name"],
                "requirement_type": item["requirement_type"],
                "difficulty_scope": item["difficulty_scope"],
                "condition_text": item["condition_text"],
                "source_row_index": item["source_row_index"],
            }
        )
        by_title[item["title_name"]].append(
            {
                "song_name": item["song_name"],
                "requirement_type": item["requirement_type"],
                "difficulty_scope": item["difficulty_scope"],
                "condition_text": item["condition_text"],
                "source_row_index": item["source_row_index"],
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "rows_total": len(rows),
            "relations_total": len(deduped),
            "songs_total": len(by_song),
            "titles_total": len(by_title),
        },
        "relations": deduped,
        "by_song": dict(sorted(by_song.items(), key=lambda item: item[0].lower())),
        "by_title": dict(sorted(by_title.items(), key=lambda item: item[0].lower())),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract song-title mappings from title_wikitable JSON.")
    parser.add_argument(
        "--input",
        default="assets/data/title_wikitable.json",
        help="Path to source table JSON.",
    )
    parser.add_argument(
        "--output",
        default="assets/data/title_song_relations.json",
        help="Path to output relation JSON.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    result = build_relations(payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"done: rows={result['stats']['rows_total']} relations={result['stats']['relations_total']} "
        f"songs={result['stats']['songs_total']} titles={result['stats']['titles_total']}"
    )
    print(f"output: {output_path}")


if __name__ == "__main__":
    main()

