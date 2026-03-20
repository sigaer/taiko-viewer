#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import quote, unquote, urljoin

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

BASE_URL = "https://wikiwiki.jp/taiko-fumen/段位道場/ニジイロ2025/"
ROOT_URL = "https://wikiwiki.jp"
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
    "玄人",
    "名人",
    "超人",
    "達人",
]

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


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def rewrite_href(href: str) -> str:
    absolute_url = urljoin(ROOT_URL, href)
    decoded_url = unquote(absolute_url)

    if "/段位道場/ニジイロ2025/" in decoded_url:
        grade_slug = decoded_url.rsplit("/", 1)[-1]
        return f"/grade/2025/{grade_slug}"
    if "/段位道場/ニジイロ2024/" in decoded_url:
        return "/grade/2024"
    if "/段位道場/ニジイロ2023/" in decoded_url:
        return "/grade/2023"
    return absolute_url


def sanitize_html(node: BeautifulSoup) -> str:
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


def parse_page(slug: str) -> dict[str, object]:
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

    sections: list[dict[str, object]] = []
    current_section: dict[str, object] | None = None

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

    return {
        "slug": slug,
        "title": clean_text(title_node.get_text(" ", strip=True)),
        "displayTitle": display_title,
        "sourceUrl": url,
        "lastModified": clean_text(last_modified_node.get_text(" ", strip=True)) if last_modified_node else "-",
        "navigationHtml": sanitize_html(nav_block) if nav_block is not None else "",
        "sections": sections,
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    output_path = repo_root / "taiko_frontend_back" / "assets" / "data" / "grade_dojo_nijiiro_2025.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "year": "2025",
        "title": "虹段位道场 2025",
        "sourceBaseUrl": BASE_URL,
        "grades": [parse_page(slug) for slug in SLUGS],
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
