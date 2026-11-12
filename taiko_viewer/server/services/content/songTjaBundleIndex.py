#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from taiko_bot.offline import merge_index
from taiko_bot.offline.catalog_resources import safe_resource


def build_song_tja_index(song_data_path: Path, tja_root: Path):
    with song_data_path.open("r", encoding="utf-8") as handle:
        song_data = json.load(handle)

    candidates = indexes = None

    matches = {}
    unresolved = []

    for song in song_data:
        song_id = int(song.get("id", 0) or 0)
        if song_id <= 0:
            continue

        # The catalog's verified ESE path is shared with the importer and Bot.
        source_root = tja_root
        if song.get("resource_source") == "ourtaiko":
            from taiko_bot.offline.catalog_downloads import catalog_resource_root
            source_root = catalog_resource_root(song, tja_root, runtime_root=song_data_path.parent.parent)
        path = safe_resource(source_root, song.get("tja_path"))
        if path is not None:
            matches[str(song_id)] = {"tja_path": str(path), "rel_path": path.relative_to(source_root.resolve()).as_posix()}
            continue
        if song.get("ourtaiko_ids"):
            unresolved.append({"id": song_id, "reason": "catalog_tja_unavailable"})
            continue
        if candidates is None:
            tja_files = merge_index.find_tja_files(str(tja_root))
            candidates = []
            for path in tja_files:
                try:
                    candidates.append(merge_index.build_candidate_summary(path, tja_root))
                except Exception:
                    continue
            indexes = merge_index.build_candidate_indexes(candidates)

        candidate, debug = merge_index.select_candidate(
            song,
            candidates,
            *indexes,
            tja_root,
        )
        if candidate is None:
            unresolved.append(
                {
                    "id": song_id,
                    "song_name_jp": song.get("song_name_jp"),
                    "song_name": song.get("song_name"),
                    "reason": debug,
                }
            )
            continue

        song_records, record_error = merge_index.build_song_records(song, candidate.path)
        if song_records is None:
            unresolved.append(
                {
                    "id": song_id,
                    "song_name_jp": song.get("song_name_jp"),
                    "song_name": song.get("song_name"),
                    "reason": record_error,
                    "selected_path": candidate.rel_path,
                    "selected_debug": debug,
                }
            )
            continue

        matches[str(song_id)] = {
            "tja_path": candidate.path,
            "rel_path": candidate.rel_path,
        }

    return {
        "tja_root": str(tja_root),
        "song_count": len(song_data),
        "matched_count": len(matches),
        "unresolved_count": len(unresolved),
        "matches": matches,
        "unresolved": unresolved,
    }


def main():
    parser = argparse.ArgumentParser(description="Build song ID to TJA path index for viewer downloads")
    parser.add_argument("--song-data", required=True, help="Path to song_data.json")
    parser.add_argument("--tja-root", required=True, help="Path to the ESE TJA root")
    args = parser.parse_args()

    payload = build_song_tja_index(
        song_data_path=Path(args.song_data),
        tja_root=Path(args.tja_root),
    )
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
