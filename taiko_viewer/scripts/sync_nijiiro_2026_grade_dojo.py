#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, unquote, urljoin

import requests
from bs4 import BeautifulSoup, Tag

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

ROOT_URL = "https://wikiwiki.jp"
BASE_URL = "https://wikiwiki.jp/taiko-fumen/段位道場/ニジイロ2026/"
YEAR = "2026"
TITLE = "虹段位道场 2026"
SLUGS = [
    "五級",
    "四級",
    "三級",
    "二級",
    "一級",
    "初段",
    "二段",
    "三段",
    "四段",
    "五段",
    "六段",
    "七段",
    "八段",
    "九段",
    "十段",
]
KYU_SLUGS = {"五級", "四級", "三級", "二級", "一級"}
DAN_SLUGS = {"初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段"}
GOLD_CONDITION_OVERRIDES = {
    # Confirmed gold ok-count limits that are not yet fully reflected in the source table.
    "七段": {"okCountLessThan": 200},
    "八段": {"okCountLessThan": 136},
}

REMOVE_SELECTORS = [
    "script",
    ".caption-flybox",
    ".fold-container",
    ".pcomment-form-placeholder",
    ".anchor_super",
    ".anchor-link",
    ".system-icon",
    ".note_super",
    ".tooltip",
    ".comment-pagenate",
    ".comment-write",
    ".comment-button",
    ".comment-form",
    ".includex",
]
ALLOWED_TAGS = {
    "div",
    "p",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "strong",
    "em",
    "span",
    "br",
    "a",
}
LABEL_PASS = "合格条件"
LABEL_GOLD = "金合格条件"
LABELS = {LABEL_PASS, LABEL_GOLD}
REGION_COMMON = "common"
REGION_JP = "jp"
REGION_CN = "cn"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def viewer_output_path() -> Path:
    return repo_root() / "assets" / "data" / "grade_dojo_nijiiro_2026.json"


def taiko_root() -> Path:
    return Path("/home/sigaer/taiko")


def simple_output_path() -> Path:
    return taiko_root() / "songs" / "grade_dojo_nijiiro_2026_simple.json"


def song_data_path() -> Path:
    return taiko_root() / "songs" / "song_data.json"


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\u3000", " ").strip()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("（裏譜面）", "").replace("(裏譜面)", "")
    text = text.replace("（裏）", "").replace("(裏)", "")
    text = re.sub(r"\s*[‐‑–—-]\s*", "-", text)
    text = text.replace("’", "'")
    return text


def display_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(str(value))
    except Exception:
        return default


def first_int(value: str, default: int = 0) -> int:
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else default


def rewrite_href(href: str) -> str:
    absolute_url = urljoin(ROOT_URL, href)
    decoded_url = unquote(absolute_url)

    if "/段位道場/ニジイロ2026/" in decoded_url:
        grade_slug = decoded_url.rsplit("/", 1)[-1]
        return f"/grade/2026/{grade_slug}"
    if "/段位道場/ニジイロ2025/" in decoded_url:
        grade_slug = decoded_url.rsplit("/", 1)[-1]
        return f"/grade/2025/{grade_slug}"
    if "/段位道場/ニジイロ2024/" in decoded_url:
        return "/grade/2024"
    if "/段位道場/ニジイロ2023/" in decoded_url:
        return "/grade/2023"
    return absolute_url


def sanitize_html(node: Tag | BeautifulSoup | None) -> str:
    if node is None:
        return ""

    soup = BeautifulSoup(str(node), "html.parser")
    for selector in REMOVE_SELECTORS:
        for target in soup.select(selector):
            target.decompose()

    for element in list(soup.find_all(True)):
        if element.name not in ALLOWED_TAGS:
            element.unwrap()
            continue

        attrs: dict[str, object] = {}
        if element.name == "a":
            href = element.get("href")
            if href:
                rewritten_href = rewrite_href(href)
                attrs["href"] = rewritten_href
                if rewritten_href.startswith("http"):
                    attrs["target"] = "_blank"
                    attrs["rel"] = "noopener noreferrer"
        for key in ("style", "colspan", "rowspan", "class"):
            if element.has_attr(key):
                attrs[key] = element.get(key)
        element.attrs = attrs

    html = "".join(str(child) for child in soup.contents).strip()
    return re.sub(r"\n{3,}", "\n\n", html)


def has_region_marker(text: str) -> bool:
    cleaned = clean_text(text)
    return any(marker in cleaned for marker in ("中国版", "共通", "日本版", "アジア版"))


def classify_region(text: str) -> str:
    cleaned = clean_text(text)
    if not cleaned:
        return REGION_COMMON
    if "中国版" in cleaned:
        return REGION_CN
    if "共通" in cleaned:
        return REGION_COMMON
    if "日本版" in cleaned or "アジア版" in cleaned:
        return REGION_JP
    return REGION_COMMON


def select_rows_for_region(rows: List[List[str]], region: str = REGION_JP) -> List[List[str]]:
    if not rows:
        return rows

    selected: List[List[str]] = []
    for row in rows:
        kind = classify_region(row[-1] if row else "")
        if region == REGION_CN:
            if kind in {REGION_COMMON, REGION_CN}:
                selected.append(row)
        else:
            if kind in {REGION_COMMON, REGION_JP}:
                selected.append(row)
    return selected or rows


def expand_table_rows(section: Tag) -> List[List[str]]:
    rows: List[List[str]] = []
    carried: Dict[int, Dict[str, Any]] = {}

    for tr in section.select("tr"):
        row: List[str] = []
        col_idx = 0

        def fill_carried() -> None:
            nonlocal col_idx
            while col_idx in carried:
                slot = carried[col_idx]
                row.append(slot["text"])
                slot["remain"] -= 1
                if slot["remain"] <= 0:
                    carried.pop(col_idx, None)
                col_idx += 1

        fill_carried()
        for cell in tr.find_all(["td", "th"], recursive=False):
            fill_carried()
            text = clean_text(cell.get_text(" ", strip=True))
            rowspan = safe_int(cell.get("rowspan"), 1)
            colspan = safe_int(cell.get("colspan"), 1)
            for _ in range(max(1, colspan)):
                row.append(text)
                if rowspan > 1:
                    carried[col_idx] = {"text": text, "remain": rowspan - 1}
                col_idx += 1
            fill_carried()
        fill_carried()
        if row:
            rows.append(row)

    if not rows:
        return rows
    width = max(len(row) for row in rows)
    return [row + [""] * (width - len(row)) for row in rows]


def difficulty_to_level(title: str, difficulty_text: str) -> str:
    raw_title = str(title or "")
    raw_diff = str(difficulty_text or "")
    if "かんたん" in raw_diff:
        return "level1"
    if "ふつう" in raw_diff:
        return "level2"
    if "むずかしい" in raw_diff:
        return "level3"
    if "おに" in raw_diff:
        if any(token in raw_title for token in ("(裏", "（裏", "裏譜面")):
            return "level5"
        return "level4"
    return "level4"


def normalized_title_candidates(title: str) -> List[str]:
    cleaned_title = re.sub(r"\s*\*\d+\s*$", "", str(title or ""))
    base = clean_text(normalize_text(cleaned_title))
    candidates = {
        base,
        base.replace(" ： ", "："),
        base.replace("：", ":"),
        base.replace(" : ", ":"),
        base.replace(": ", ":").replace(" :", ":"),
        base.replace(" × ", "×"),
        base.replace(" x ", "×"),
    }
    expanded = set(candidates)
    for item in list(candidates):
        expanded.add(item.replace(" ： ", ":"))
        expanded.add(item.replace("：", " : "))
        expanded.add(item.replace("・", "･"))
        expanded.add(item.replace("･", "・"))
    return [clean_text(item) for item in expanded if clean_text(item)]


def build_song_index() -> Dict[str, Dict[str, Any]]:
    payload = json.loads(song_data_path().read_text(encoding="utf-8"))
    index: Dict[str, Dict[str, Any]] = {}
    for song in payload:
        if not isinstance(song, dict):
            continue
        title_jp = song.get("song_name_jp")
        if not title_jp:
            continue
        for normalized in normalized_title_candidates(title_jp):
            index.setdefault(normalized, song)
    return index


def build_existing_simple_index() -> Dict[str, Dict[str, Any]]:
    path = simple_output_path()
    if not path.exists():
        return {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    title_index: Dict[str, Dict[str, Any]] = {}
    for grade in payload.get("grades", []):
        for song in grade.get("songs", []):
            title = song.get("title")
            if not title:
                continue
            for normalized in normalized_title_candidates(title):
                title_index.setdefault(normalized, song)
    return title_index


def parse_song_rows(block_html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(block_html, "html.parser")
    grouped: Dict[int, List[List[str]]] = {}
    for row in select_rows_for_region(expand_table_rows(soup.select_one("table") or soup)):
        if len(row) < 5:
            continue
        order_match = re.search(r"(\d+)曲目", row[0])
        if not order_match:
            continue
        grouped.setdefault(int(order_match.group(1)), []).append(row)

    out: List[Dict[str, Any]] = []
    for order in sorted(grouped):
        chosen = grouped[order][0]
        out.append(
            {
                "order": order,
                "title": display_text(chosen[1]),
                "difficultyText": display_text(chosen[2]),
                "noteCount": first_int(chosen[3]),
                "bpm": display_text(chosen[4]),
            }
        )
    return out


def parse_metric_token(token: str) -> Dict[str, Any]:
    text = clean_text(token)
    compact = re.sub(r"\*+\d+$", "", text.replace(" ", ""))
    out: Dict[str, Any] = {}

    match = re.fullmatch(r"魂ゲージ(\d+)%?(?:以上)?", compact)
    if match:
        out["gauge_min_percent"] = int(match.group(1))
        return out

    match = re.fullmatch(r"良(\d+)(?:以上|未満)?", compact)
    if match:
        out["good_min"] = int(match.group(1))
        return out

    match = re.fullmatch(r"可(\d+)(?:以上|未満)?", compact)
    if match:
        out["ok_max"] = int(match.group(1))
        return out

    match = re.fullmatch(r"不可(\d+)(?:以上|未満)?", compact)
    if match:
        out["miss_max"] = int(match.group(1))
        return out

    match = re.fullmatch(r"たたけた数(\d+)以上", compact)
    if match:
        out["hit_count_min"] = int(match.group(1))
        return out

    match = re.fullmatch(r"連打数(\d+)打(?:以上)?", compact)
    if match:
        out["drumroll_min"] = int(match.group(1))
        return out

    return out


def parse_condition_rows(block_html: str) -> Dict[str, List[Dict[str, Any]]]:
    soup = BeautifulSoup(block_html, "html.parser")
    table = soup.select_one("table")
    if table is None:
        return {LABEL_PASS: [], LABEL_GOLD: []}

    body_rows = expand_table_rows(table.find("tbody") or table)
    selected_rows = select_rows_for_region(body_rows)
    groups: Dict[str, List[Dict[str, Any]]] = {LABEL_PASS: [], LABEL_GOLD: []}

    for row in selected_rows:
        if len(row) < 2:
            continue
        label = clean_text(row[0])
        if label not in LABELS:
            continue

        tokens = [clean_text(cell) for cell in row[1:]]
        if tokens and has_region_marker(tokens[-1]):
            tokens = tokens[:-1]
        metrics: Dict[str, Any] = {}
        for token in tokens:
            if not token:
                continue
            parsed = parse_metric_token(token)
            metrics.update(
                {
                    key: value
                    for key, value in parsed.items()
                    if key
                    in {
                        "gauge_min_percent",
                        "good_min",
                        "ok_max",
                        "miss_max",
                        "hit_count_min",
                        "drumroll_min",
                    }
                }
            )
        if metrics:
            groups[label].append(metrics)
    return groups


def compress_metric(rows: List[Dict[str, Any]], key: str) -> Any:
    values = [row[key] for row in rows if key in row]
    if not values:
        return None
    if all(value == values[0] for value in values):
        return values[0]
    return values


def build_condition_payload(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    mapping = {
        "gauge_min_percent": "soulGaugePercent",
        "good_min": "goodCountAtLeast",
        "ok_max": "okCountLessThan",
        "miss_max": "badCountLessThan",
        "hit_count_min": "hitCountAtLeast",
        "drumroll_min": "drumrollCountAtLeast",
    }
    for source_key, target_key in mapping.items():
        value = compress_metric(rows, source_key)
        if value is not None:
            out[target_key] = value
    return out


def resolved_gold_conditions(slug: str, pass_cond: Dict[str, Any], gold_cond: Dict[str, Any]) -> Dict[str, Any]:
    resolved = dict(gold_cond)

    if slug in DAN_SLUGS and resolved.get("soulGaugePercent") is None:
        resolved["soulGaugePercent"] = 100
    if slug == "一級" and resolved.get("soulGaugePercent") is None:
        resolved["soulGaugePercent"] = 100

    pass_bad = pass_cond.get("badCountLessThan")
    if resolved.get("badCountLessThan") is None and isinstance(pass_bad, int) and pass_bad > 0:
        resolved["badCountLessThan"] = pass_bad // 2

    override = GOLD_CONDITION_OVERRIDES.get(slug)
    if override:
        resolved.update(override)

    return resolved


def compute_required_good(note_total: int, cond: Dict[str, Any]) -> Optional[int]:
    if note_total <= 0:
        return None
    good = cond.get("goodCountAtLeast")
    if isinstance(good, int) and good > 0:
        return good

    ok_limit = cond.get("okCountLessThan")
    bad_limit = cond.get("badCountLessThan")
    if isinstance(ok_limit, int) and ok_limit > 0 and isinstance(bad_limit, int) and bad_limit > 0:
        return max(0, note_total - (ok_limit - 1) - (bad_limit - 1))
    if isinstance(ok_limit, list) and ok_limit and isinstance(bad_limit, int) and bad_limit > 0:
        ok_total = sum(max(0, safe_int(item) - 1) for item in ok_limit)
        return max(0, note_total - ok_total - (bad_limit - 1))
    return None


def good_ratio_percent(note_total: int, cond: Dict[str, Any]) -> Optional[float]:
    required_good = compute_required_good(note_total, cond)
    if required_good is None or note_total <= 0:
        return None
    return required_good / float(note_total) * 100.0


def set_inner_html(cell: Tag, html: str) -> None:
    cell.clear()
    fragment = BeautifulSoup(html, "html.parser")
    for child in list(fragment.contents):
        cell.append(child)


def patch_metric_cell(cell: Tag, cond: Dict[str, Any], note_total: int) -> None:
    html = cell.decode_contents()
    text = clean_text(cell.get_text(" ", strip=True))

    gauge = cond.get("soulGaugePercent")
    if "魂ゲージ" in text and "?" in text and isinstance(gauge, int):
        suffix = "以上" if "以上" in text else ""
        html = re.sub(r"魂ゲージ\?+%?(?:以上)?", f"魂ゲージ{gauge}%{suffix}", html)

    good = cond.get("goodCountAtLeast")
    if "良" in text and "?" in text and isinstance(good, int):
        html = re.sub(r"良\?+以上", f"良{good}以上", html)
        html = re.sub(r"良\?+未満", f"良{good}未満", html)

    ok_limit = cond.get("okCountLessThan")
    if "可" in text and "?" in text and isinstance(ok_limit, int):
        html = re.sub(r"可\?+未満", f"可{ok_limit}未満", html)
        html = re.sub(r"可\?+以下", f"可{max(0, ok_limit - 1)}以下", html)

    bad_limit = cond.get("badCountLessThan")
    if "不可" in text and "?" in text and isinstance(bad_limit, int):
        html = re.sub(r"不可\?+未満", f"不可{bad_limit}未満", html)
        html = re.sub(r"不可\?+以下", f"不可{max(0, bad_limit - 1)}以下", html)

    hit = cond.get("hitCountAtLeast")
    if "たたけた数以上" in text and isinstance(hit, int):
        html = html.replace("たたけた数以上", f"たたけた数{hit}以上")

    required_good = compute_required_good(note_total, cond)
    if "良????以上" in html and isinstance(required_good, int):
        html = html.replace("良????以上", f"良{required_good}以上")
    if "良????以上" in text and isinstance(required_good, int):
        html = re.sub(r"良\?+以上", f"良{required_good}以上", html)

    ratio = good_ratio_percent(note_total, cond)
    if ratio is not None and "約??.??" in text:
        html = re.sub(r"約\?+\.\?+([％%])", lambda m: f"約{ratio:.2f}{m.group(1)}", html)

    if html != cell.decode_contents():
        set_inner_html(cell, html)


def patch_detail_blocks(
    children: List[Tag],
    note_total: int,
    pass_cond: Dict[str, Any],
    gold_cond: Dict[str, Any],
) -> None:
    detail = False
    for child in children:
        if child.name == "h3":
            title = clean_text(child.get_text(" ", strip=True))
            detail = title == "詳細"
            if title == "攻略":
                break
            continue
        if not detail:
            continue

        text = clean_text(child.get_text(" ", strip=True))
        if "合格条件" in text and "条件1" in text:
            current_label: Optional[str] = None
            for tr in child.select("tbody tr"):
                cells = tr.find_all("td")
                if not cells:
                    continue
                first_text = clean_text(cells[0].get_text(" ", strip=True))
                start_idx = 0
                if first_text in LABELS:
                    current_label = first_text
                    start_idx = 1
                cond = pass_cond if current_label == LABEL_PASS else gold_cond if current_label == LABEL_GOLD else None
                if cond is None:
                    continue
                for cell in cells[start_idx:]:
                    patch_metric_cell(cell, cond, note_total)
            continue

        if "補足" in text:
            current_label = None
            for tr in child.select("tbody tr"):
                cells = tr.find_all("td")
                if not cells:
                    continue
                first_text = clean_text(cells[0].get_text(" ", strip=True))
                start_idx = 0
                if first_text in LABELS:
                    current_label = first_text
                    start_idx = 1
                cond = pass_cond if current_label == LABEL_PASS else gold_cond if current_label == LABEL_GOLD else None
                if cond is None:
                    continue
                for cell in cells[start_idx:]:
                    patch_metric_cell(cell, cond, note_total)
            continue


def build_simple_song_entry(
    song_row: Dict[str, Any],
    song_index: Dict[str, Dict[str, Any]],
    existing_simple_index: Dict[str, Dict[str, Any]],
    pass_cond: Dict[str, Any],
) -> Dict[str, Any]:
    existing_entry = None
    matched_song = None
    for normalized in normalized_title_candidates(song_row["title"]):
        existing_entry = existing_simple_index.get(normalized)
        matched_song = song_index.get(normalized)
        if existing_entry or matched_song:
            break

    song_id = -1
    if existing_entry is not None:
        song_id = safe_int(existing_entry.get("id"), -1)
    elif matched_song is not None:
        song_id = safe_int(matched_song.get("id"), -1)

    accuracy_formula = (
        "good_over_total" if pass_cond.get("goodCountAtLeast") is not None else "total_minus_ok_minus_1_over_total"
    )

    return {
        "id": song_id,
        "title": song_row["title"],
        "difficulty": difficulty_to_level(song_row["title"], song_row["difficultyText"]),
        "noteCount": song_row["noteCount"],
        "accuracyFormula": accuracy_formula,
    }


def parse_page(
    slug: str,
    song_index: Dict[str, Dict[str, Any]],
    existing_simple_index: Dict[str, Dict[str, Any]],
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    url = f"{BASE_URL}{quote(slug)}"
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    content = soup.select_one("#content")
    title_node = soup.select_one("#title .title")
    last_modified_node = soup.select_one("#lastmodified")
    if content is None or title_node is None:
        raise RuntimeError(f"Page structure changed for {slug}")

    children = content.find_all(recursive=False)
    nav_block = next(
        (
            child
            for child in children
            if child.name == "div" and "h-scrollable" in (child.get("class") or [])
        ),
        None,
    )

    display_title = slug
    if nav_block is not None:
        display_title_node = nav_block.select_one("tbody tr td strong")
        if display_title_node is not None:
            display_title = clean_text(display_title_node.get_text(" ", strip=True))

    detail = False
    song_block: Optional[Tag] = None
    condition_block: Optional[Tag] = None
    for child in children:
        if child.name == "h3":
            title = clean_text(child.get_text(" ", strip=True))
            detail = title == "詳細"
            if title == "攻略":
                break
            continue
        if not detail:
            continue
        text = clean_text(child.get_text(" ", strip=True))
        if song_block is None and "楽曲情報" in text and "最大コンボ数" in text:
            song_block = child
        elif condition_block is None and "合格条件" in text and "条件1" in text:
            condition_block = child

    song_rows = parse_song_rows(str(song_block or ""))
    note_total = sum(song["noteCount"] for song in song_rows)
    condition_rows = parse_condition_rows(str(condition_block or ""))
    pass_cond = build_condition_payload(condition_rows[LABEL_PASS])
    raw_gold_cond = build_condition_payload(condition_rows[LABEL_GOLD])
    final_gold_cond = resolved_gold_conditions(slug, pass_cond, raw_gold_cond)

    patch_detail_blocks(children, note_total, pass_cond, final_gold_cond)

    sections: list[dict[str, Any]] = []
    current_section: dict[str, Any] | None = None

    for child in children:
        if child.name == "h3":
            title = clean_text(child.get_text(" ", strip=True))
            if title == "コメント":
                current_section = {"title": title, "blocks": []}
                continue
            current_section = {"title": title, "blocks": []}
            sections.append(current_section)
            continue

        if current_section is None or current_section["title"] == "コメント":
            continue

        if child.name == "div" and "tab-container" in (child.get("class") or []):
            tabs = []
            for tab_content in child.select(".tab-contents > .tab-content"):
                tab_name_node = tab_content.select_one(".tab-name")
                tab_title = (
                    clean_text(tab_name_node.get_text(" ", strip=True))
                    if tab_name_node is not None
                    else f"内容{len(tabs) + 1}"
                )
                sanitized_tab = BeautifulSoup(str(tab_content), "html.parser")
                hidden_name = sanitized_tab.select_one(".tab-name")
                if hidden_name is not None:
                    hidden_name.decompose()
                tab_html = sanitize_html(sanitized_tab)
                tab_text = clean_text(BeautifulSoup(tab_html, "html.parser").get_text(" ", strip=True))
                if tab_text:
                    tabs.append({"title": tab_title, "html": tab_html})
            if tabs:
                current_section["tabs"] = tabs
            continue

        if child.name not in {"ul", "div", "p"}:
            continue

        block_html = sanitize_html(child)
        block_text = clean_text(BeautifulSoup(block_html, "html.parser").get_text(" ", strip=True))
        if not block_text:
            continue
        current_section["blocks"].append({"type": child.name, "html": block_html})

    page_payload = {
        "slug": slug,
        "title": clean_text(title_node.get_text(" ", strip=True)),
        "displayTitle": display_title,
        "sourceUrl": url,
        "lastModified": clean_text(last_modified_node.get_text(" ", strip=True)) if last_modified_node else "-",
        "navigationHtml": sanitize_html(nav_block),
        "sections": sections,
    }

    simple_payload = {
        "grade": slug,
        "songs": [
            build_simple_song_entry(song_row, song_index, existing_simple_index, pass_cond) for song_row in song_rows
        ],
        "conditions": {
            "pass": pass_cond,
            "gold": final_gold_cond,
        },
        "sourceUrl": url,
    }

    return page_payload, simple_payload


def main() -> None:
    song_index = build_song_index()
    existing_simple_index = build_existing_simple_index()

    pages: List[Dict[str, Any]] = []
    simple_grades: List[Dict[str, Any]] = []
    for slug in SLUGS:
        page_payload, simple_payload = parse_page(slug, song_index, existing_simple_index)
        pages.append(page_payload)
        simple_grades.append(simple_payload)

    viewer_payload = {
        "year": YEAR,
        "title": TITLE,
        "sourceBaseUrl": BASE_URL,
        "grades": pages,
    }
    simple_payload = {
        "year": YEAR,
        "grades": simple_grades,
    }

    viewer_path = viewer_output_path()
    viewer_path.parent.mkdir(parents=True, exist_ok=True)
    viewer_path.write_text(json.dumps(viewer_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    simple_path = simple_output_path()
    simple_path.parent.mkdir(parents=True, exist_ok=True)
    simple_path.write_text(json.dumps(simple_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {viewer_path}")
    print(f"Wrote {simple_path}")


if __name__ == "__main__":
    main()
