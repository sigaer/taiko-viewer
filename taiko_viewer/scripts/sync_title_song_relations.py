#!/usr/bin/env python3
"""Publish resolved title/song IDs through the existing authenticated title API.

Dry-run by default. Never use official IDs as local database row IDs, delete titles,
replace conditions, or remove existing song associations.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import fcntl
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from title_relation_ids import title_name_key, positive_id

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG = ROOT / "data/title_sync.json"
DEFAULT_RELATIONS = Path(__file__).resolve().parents[1] / "assets/data/title_song_relations.json"
DEFAULT_API = "http://8.138.33.103:4290"


def song_ids(row):
    values = row.get("songIds", row.get("song_ids", [])) or []
    if not isinstance(values, list) or any(positive_id(value) is None for value in values):
        raise ValueError("Invalid song IDs")
    return sorted({int(value) for value in values})


def title_key(row):
    name = str(row.get("name", row.get("title_name", ""))).strip()
    rarity = row.get("rarity")
    if not name or isinstance(rarity, bool) or not isinstance(rarity, int) or rarity < 0:
        raise ValueError("Invalid title name or plate")
    return title_name_key(name), rarity


def build_plan(payload, local):
    if payload.get("schema_version") != 2 or not isinstance(payload.get("title_bindings"), list):
        raise ValueError("ID-enriched relation schema v2 is required")
    groups = defaultdict(list)
    for row in local:
        if positive_id(row.get("id")) is None:
            raise ValueError("Invalid local title ID")
        groups[title_key(row)].append(row)
    bindings = defaultdict(list)
    for row in payload["title_bindings"]:
        if positive_id(row.get("official_title_id")) is None:
            raise ValueError("Invalid official title ID")
        bindings[title_key(row)].append(row)
    changes, skipped = [], []
    for key, rows in sorted(bindings.items()):
        if len(rows) != 1 or len(groups[key]) > 1:
            skipped.append({"name": rows[0]["title_name"], "rarity": key[1], "reason": "ambiguous_title"})
            continue
        binding = rows[0]
        desired = song_ids(binding)
        if binding.get("complete") is not True or not desired:
            skipped.append({"name": binding["title_name"], "rarity": key[1], "reason": "unresolved_song"})
            continue
        current = groups[key][0] if groups[key] else None
        before = song_ids(current) if current else []
        after = sorted(set(before) | set(desired))
        if current and before == after:
            continue
        changes.append({
            "action": "update" if current else "add",
            "name": binding["title_name"], "rarity": binding["rarity"],
            "local_id": int(current["id"]) if current else None,
            "official_title_id": binding["official_title_id"],
            "condition": binding.get("condition", ""),
            "desired_song_ids": desired, "before": before, "after": after,
        })
    return {"changes": changes, "skipped": skipped}


class TitleAPI:
    def __init__(self, base, token="", *, deadline=None):
        parsed = urllib.parse.urlsplit(base)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Invalid title API URL")
        self.base = base.rstrip("/")
        self.token = token
        self.deadline = deadline or time.monotonic() + 300

    def request(self, method, path, body=None):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Title synchronization deadline exceeded")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        # No retries on writes, including unknown outcomes after a timeout.
        try:
            with urllib.request.urlopen(request, timeout=min(15, remaining)) as response:
                raw = response.read(4 * 1024 * 1024 + 1)
            if len(raw) > 4 * 1024 * 1024:
                raise ValueError("Title API response exceeds limit")
            result = json.loads(raw)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Title API {method} failed: HTTP {error.code}") from None
        except (urllib.error.URLError, OSError, ValueError):
            raise RuntimeError(f"Title API {method} transport or response failure") from None
        if not isinstance(result, dict) or result.get("code") != 0:
            raise RuntimeError(f"Title API {method} rejected request")
        return result.get("data")

    def list_titles(self):
        rows, seen, total = [], set(), None
        for page in range(1, 21):
            data = self.request("GET", f"/taiko/title/page?page={page}&pageSize=500")
            if not isinstance(data, dict) or not isinstance(data.get("pageData"), list):
                raise ValueError("Invalid local title page")
            count = data.get("total")
            if isinstance(count, bool) or not isinstance(count, int) or count < 0 or (total is not None and total != count):
                raise ValueError("Local title total changed or invalid")
            total = count
            for row in data["pageData"]:
                title_id = positive_id(row.get("id"))
                if title_id is None or title_id in seen:
                    raise ValueError("Invalid or repeated local title ID")
                title_key(row)
                song_ids(row)
                seen.add(title_id)
                rows.append(row)
            if len(rows) == total:
                return rows
            if not data["pageData"] or len(rows) > total:
                break
        raise ValueError("Incomplete local title catalog")

    def authenticate(self, config):
        self.token = str(config.get("token") or "").removeprefix("Bearer ").strip()
        if not self.token:
            username, password = config.get("username"), config.get("password")
            if not username or not password:
                raise ValueError("Title sync config needs a token or username/password")
            token = self.request("POST", "/taiko/login", {"username": username, "password": password})
            if not isinstance(token, str) or not token:
                raise ValueError("Title API returned no login token")
            self.token = token
        identity = self.request("GET", "/taiko/manage/auth/me")
        if not isinstance(identity, dict) or positive_id(identity.get("id")) is None:
            raise ValueError("Title API returned invalid administrator identity")


def apply_plan(api, payload, plan):
    updated = added = 0
    for change in plan["changes"]:
        if change["action"] == "update":
            current = api.request("GET", f"/taiko/title/get?id={change['local_id']}")
            if not isinstance(current, dict) or title_key(current) != title_key(change) or current.get("id") != change["local_id"]:
                raise ValueError("Local title changed identity during synchronization")
            merged = sorted(set(song_ids(current)) | set(change["desired_song_ids"]))
            if merged != song_ids(current):
                api.request("PUT", "/taiko/manage/title/update", {"id": change["local_id"], "songIds": merged})
                updated += 1
        else:
            api.request("POST", "/taiko/manage/title/add", {
                "name": change["name"], "rarity": change["rarity"],
                "condition": change["condition"], "songIds": change["after"],
            })
            added += 1
    published = api.list_titles()
    for change in plan["changes"]:
        matches = [row for row in published if title_key(row) == title_key(change)]
        expected = set(change["before"]) | set(change["desired_song_ids"])
        if len(matches) != 1 or not expected.issubset(song_ids(matches[0])):
            raise RuntimeError("Title API read-back verification failed; rerun starts with a fresh catalog")
    remaining = build_plan(payload, published)
    if remaining["changes"]:
        raise RuntimeError("Title API read-back verification failed; rerun starts with a fresh catalog")
    return {"updated": updated, "added": added, "skipped": len(plan["skipped"]), "verified": True}


def read_config(path):
    info = path.stat()
    if info.st_mode & 0o077 or info.st_uid not in {0, os.geteuid()}:
        raise ValueError("Title sync config must be owner-only (chmod 600)")
    result = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(result, dict):
        raise ValueError("Invalid title sync config")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--relations", type=Path, default=DEFAULT_RELATIONS)
    parser.add_argument("--config", type=Path, default=Path(os.environ.get("TAIKO_TITLE_SYNC_CONFIG", str(DEFAULT_CONFIG))))
    parser.add_argument("--api-base", help="Public API URL for a dry-run; apply uses private config")
    parser.add_argument("--report", type=Path, help="Optional review report with catalog data only")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    config = read_config(args.config) if args.config.exists() else {}
    if args.apply and not config:
        raise ValueError("Missing private title sync config")
    payload = json.loads(args.relations.read_text(encoding="utf-8"))
    api = TitleAPI(str(config.get("api_base") or args.api_base or DEFAULT_API))
    # The persistent lock covers planning, writes and read-back, including manual reruns.
    lock_path = args.config.with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        plan = build_plan(payload, api.list_titles())
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if args.apply:
            api.authenticate(config)
            result = apply_plan(api, payload, plan)
        else:
            result = {"dry_run": True, "updates": sum(c["action"] == "update" for c in plan["changes"]),
                      "adds": sum(c["action"] == "add" for c in plan["changes"]), "skipped": len(plan["skipped"])}
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never dump private config, tokens, response bodies or credentialed URLs.
        print(f"Title synchronization failed ({type(error).__name__}); check configuration and service availability", file=sys.stderr)
        sys.exit(1)
