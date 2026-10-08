#!/usr/bin/env python3
"""Generate console V2 constants with pinned OurTaiko code and global calibration.

Run inside scripts/memory/run_qa.sh; sources and intermediate files stay in --work-dir.
Only charts whose single-player course and note count match the catalog are published.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

VIEWER = Path(__file__).resolve().parents[1]
DIFFICULTIES = {"hard": 2, "oni": 3, "edit": 4}
REFERENCE_IDS = (1, 495, 1172)
PATH_OVERRIDES = {"100033": "01 Pop/LISTEN TO THE STEREO/LISTEN TO THE STEREO.tja"}
FILE_LIMIT = 4 * 1024 * 1024


def read_json(path: Path):
    if path.stat().st_size > 8 * 1024 * 1024:
        raise ValueError(f"JSON size limit: {path.name}")
    return json.loads(path.read_text(encoding="utf-8"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def prepare_sources(work: Path, manifest: dict):
    for name, source in manifest.items():
        for relative, expected in source["files"].items():
            target = work / name / relative
            if target.is_file() and target.stat().st_size <= FILE_LIMIT:
                if git_blob(target.read_bytes()) == expected:
                    continue
            url = "https://raw.githubusercontent.com/" + source["repository"] + "/" + source["tree"] + "/" + urllib.parse.quote(relative)
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "TaikoViewer-V2-console/1.0"})
                    with urllib.request.urlopen(req, timeout=15) as response:
                        data = response.read(FILE_LIMIT + 1)
                    if len(data) > FILE_LIMIT or git_blob(data) != expected:
                        raise ValueError(f"Source identity mismatch: {name}/{relative}")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    break
                except Exception:
                    if attempt == 2:
                        raise


def prepare_analyzer(work: Path, esbuild: str) -> Path:
    (work / "renderer-shim.ts").write_text(
        "import { parseTJA, getEffectiveBpm } from './TJARenderer/src/tja-parser';\n"
        "import * as primitives from './TJARenderer/src/primitives';\n"
        "export const Private = { parseTJA, getEffectiveBpm, ...primitives };\n", encoding="utf-8")
    (work / "analyze-cli.ts").write_text(
        "import { readFileSync } from 'node:fs';\n"
        "import { analyzeTJA, LongNoteHandling } from './TJAAnalyzer/offline-analysis/tja-gaps';\n"
        "const text = readFileSync(0, 'utf8').replace(/^\\uFEFF/, '');\n"
        "process.stdout.write(JSON.stringify(analyzeTJA(text, 'ms', LongNoteHandling.Skip)));\n", encoding="utf-8")
    output = work / "analyze-cli.mjs"
    result = subprocess.run([esbuild, str(work / "analyze-cli.ts"), "--bundle", "--platform=node", "--format=esm",
        f"--alias:tja-renderer={work / 'renderer-shim.ts'}", f"--outfile={output}"],
        capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr[:1000])
    return output


def positive_int(value):
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
        return parsed if parsed > 0 and float(value) == parsed else None
    except (TypeError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--song-data", type=Path, required=True)
    parser.add_argument("--tja-index", type=Path, required=True)
    parser.add_argument("--tja-root", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--node", default=shutil.which("node"))
    parser.add_argument("--esbuild", default=str(VIEWER / "node_modules/esbuild/bin/esbuild"))
    parser.add_argument("--output", type=Path, default=VIEWER / "assets/data/v2_console_constants.json")
    args = parser.parse_args()
    work = args.work_dir.resolve()
    if work.is_relative_to(VIEWER.parents[0]) or not args.node:
        parser.error("Use a disk-backed work directory outside the repository and an available Node binary")
    work.mkdir(parents=True, exist_ok=True)
    manifest = read_json(Path(__file__).with_name("v2_console_sources.json"))
    prepare_sources(work, manifest)
    helper = prepare_analyzer(work, args.esbuild)
    sys.path.insert(0, str(work / "Constants/src"))
    from tja_analysis import Chart, TJAChartAnalyzer
    from rating import RatingPipeline
    from computing_parameters import load_computing_parameters
    import algorithms
    pipeline = RatingPipeline(load_computing_parameters(work / "Constants/cached_computing_parameters.json"))
    analyzer = TJAChartAnalyzer()
    songs = read_json(args.song_data)
    index = read_json(args.tja_index)["data"]["data"]["matches"]
    root = args.tja_root.resolve()

    def analyze(song_id: str):
        relative = PATH_OVERRIDES.get(song_id) or index.get(song_id, {}).get("rel_path")
        if not relative:
            raise ValueError("missing_tja")
        path = (root / relative).resolve()
        if not path.is_relative_to(root) or path.stat().st_size > FILE_LIMIT:
            raise ValueError("invalid_tja_path_or_size")
        data = path.read_bytes()
        text = data.decode("utf-8-sig")
        proc = subprocess.run([args.node, str(helper)], input=text, text=True, capture_output=True, timeout=20)
        if proc.returncode or len(proc.stdout) > 8 * 1024 * 1024:
            raise ValueError("tja_analysis_failed: " + proc.stderr[:160])
        raw = json.loads(proc.stdout)
        return raw, {"tjaPath": relative, "tjaSha256": digest(data)}

    def calculate(raw, difficulty: str):
        # Local supplements never select a double-player course as a substitute.
        courses = raw["courses"]
        course = next((name for name in (difficulty, difficulty + "_single") if name in courses), None)
        if course is None:
            return None, {"reason": "missing_single_course"}
        branches = courses[course]
        branch = next((name for name in ("master", "unbranched") if name in branches), None)
        if branch is None:
            return None, {"reason": "missing_branch", "course": course}
        gaps = branches[branch]
        types = raw["noteTypes"][course][branch]
        intervals = analyzer.extract_intervals(gaps)
        if len(types) < 2 or len(intervals) != len(types) - 1 or any(t not in (1, 2) for t in types):
            raise ValueError("note_gap_alignment")
        # Upstream process() suppresses errors. Call the raw algorithms first so
        # malformed charts cannot silently become zero-valued constants.
        algorithms.calculate_result(intervals)
        algorithms.calculate_complete_compound_difficulty(intervals, types)
        algorithms.compute_final_rhythm_difficulty(intervals)
        algorithms.compute_speed(intervals)
        algorithms.compute_burst(intervals)
        analyzer.calc_roll_equivalent(intervals, types)
        chart = Chart(course=course, branch_type=branch, ratings=analyzer.calculate_raw_ratings(gaps, types))
        values = {"totalNotes": chart.ratings.total_notes, **pipeline.compute_all([chart])[0].as_dict()}
        if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) for v in values.values()):
            raise ValueError("non_finite_constant")
        return values, {"course": course, "branch": branch}

    reference = read_json(work / "Constants/constants.json")
    checks = []
    for sid in REFERENCE_IDS:
        raw, provenance = analyze(str(sid))
        for difficulty, expected in reference[str(sid)].items():
            actual, selection = calculate(raw, difficulty)
            delta = max(abs(actual[key] - value) for key, value in expected.items()) if actual else math.inf
            if delta > 1e-9 or actual["totalNotes"] != expected["totalNotes"]:
                raise ValueError(f"Reference calibration failed: {sid}/{difficulty} (delta {delta})")
            checks.append({"id": sid, "difficulty": difficulty, "maxAbsDelta": delta, **provenance, **selection})
    print(f"Reference gate passed: {len(checks)} charts", flush=True)
    constants, provenance, issues = {}, {}, []
    requested = 0
    family = sorted((s for s in songs if str(s.get("shelf_status")) == "2"), key=lambda s: int(s["id"]))
    for song in family:
        sid = str(song["id"])
        raw, identity = analyze(sid)
        constants[sid], provenance[sid] = {}, {"songName": song["song_name"], **identity, "charts": {}}
        for difficulty, offset in DIFFICULTIES.items():
            level = positive_int(song.get(f"level_{offset + 1}"))
            if level is None:
                continue
            requested += 1
            expected = positive_int((song.get("max_combo") or [])[offset])
            values, selection = calculate(raw, difficulty)
            issue = {"id": int(sid), "difficulty": difficulty, "expectedNotes": expected, **selection}
            if expected is None:
                issues.append({**issue, "reason": "missing_catalog_note_count"})
            elif values is None:
                issues.append(issue)
            elif values["totalNotes"] != expected:
                issues.append({**issue, "reason": "note_count_mismatch", "actualNotes": values["totalNotes"]})
            else:
                constants[sid][difficulty] = values
                provenance[sid]["charts"][difficulty] = {**selection, "catalogNotes": expected, "catalogLevel": level}
        if len(constants) % 25 == 0:
            print(f"Calculated {len(constants)}/{len(family)} songs", flush=True)
    dataset = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sources": {name: {"repository": source["repository"], "tree": source["tree"]} for name, source in manifest.items()},
        "calibrationSha256": digest((work / "Constants/cached_computing_parameters.json").read_bytes()),
        "catalogSha256": digest(args.song_data.read_bytes()),
        "analysis": {"unit": "ms", "longNoteHandling": "skip", "branchPriority": ["master", "unbranched"], "singlePlayerOnly": True},
        "referenceChecks": checks,
        "coverage": {"songs": len(family), "songsWithData": sum(bool(v) for v in constants.values()), "requestedCharts": requested,
            "generatedCharts": sum(len(v) for v in constants.values()), "excludedCharts": len(issues)},
        "issues": issues,
        "provenance": provenance,
        "constants": constants,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_name(args.output.name + ".next")
    temp.write_text(json.dumps(dataset, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    os.replace(temp, args.output)
    print(json.dumps(dataset["coverage"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
