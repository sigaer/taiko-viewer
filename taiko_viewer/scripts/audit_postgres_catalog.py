#!/usr/bin/env python3
"""Compare the running Viewer's JSON catalog with local PostgreSQL, read only.

Run through scripts/memory/run_qa.sh. No package install, web configuration,
database migration, account data query, or resource download is performed.
The Docker transport uses the container's existing private login configuration,
then SET LOCAL ROLE restricts the entire catalog read to the existing reader.
"""

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata


MAX_BYTES = 32 * 1024 * 1024
MAX_SONGS = 20_000
MAX_DIFFICULTIES = 100_000
COURSES = ("Easy", "Normal", "Hard", "Oni", "Edit")
CATEGORY_BITS = {
    "南梦宫原创音乐": 1, "流行音乐": 2, "游戏音乐": 4, "动漫音乐": 8,
    "博歌乐音乐": 16, "综合音乐": 32, "儿童音乐": 64, "古典音乐": 128,
}
REQUIRED_TABLES = ("charts", "chart_difficulties", "chart_resources")


def bounded_json(path):
    with Path(path).open("rb") as stream:
        before = os.fstat(stream.fileno())
        if before.st_size > MAX_BYTES:
            raise ValueError("JSON input exceeds 32 MiB")
        raw = stream.read(MAX_BYTES + 1)
        after = os.fstat(stream.fileno())
    if len(raw) > MAX_BYTES or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError("JSON input changed during read or exceeds size limit")
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def viewer_source(explicit_path, service):
    if explicit_path:
        return Path(explicit_path).resolve(), {"resolution": "explicit_path"}
    result = subprocess.run(
        ["systemctl", "show", service, "-p", "MainPID", "-p", "WorkingDirectory"],
        capture_output=True, text=True, timeout=5, check=True,
    )
    properties = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    pid = int(properties.get("MainPID", "0"))
    if pid <= 0:
        raise ValueError("Viewer is not running; supply --song-data explicitly")
    # Only select non-secret catalog path variables; never emit the process environment.
    with open(f"/proc/{pid}/environ", "rb") as stream:
        raw = stream.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise ValueError("Viewer environment exceeds inspection bound")
    allowed = {b"TAIKO_SONG_DATA_PATH", b"NUXT_SONG_DATA_PATH", b"TAIKO_REPO_ROOT", b"NUXT_REPO_ROOT"}
    paths = {}
    for entry in raw.split(b"\0"):
        key, separator, value = entry.partition(b"=")
        if separator and key in allowed:
            paths[key.decode()] = value.decode()
    cwd = Path(properties["WorkingDirectory"])
    root = Path(paths.get("NUXT_REPO_ROOT") or paths.get("TAIKO_REPO_ROOT") or cwd.parent)
    path = Path(paths.get("NUXT_SONG_DATA_PATH") or paths.get("TAIKO_SONG_DATA_PATH") or root / "songs/song_data.json")
    if not path.is_absolute():
        path = cwd / path
    return path.resolve(), {"resolution": "running_service", "service": service, "pid": pid, "working_directory": str(cwd)}


def catalog_sql(role):
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", role):
        raise ValueError("Invalid PostgreSQL reader role")
    return f"""
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL ROLE "{role}";
WITH base AS (
  SELECT * FROM public.charts ORDER BY id LIMIT {MAX_SONGS + 1}
), raw_difficulties AS (
  SELECT d.* FROM public.chart_difficulties d JOIN base b ON b.id=d.chart_id
  ORDER BY d.id LIMIT {MAX_DIFFICULTIES + 1}
), difficulties AS (
  SELECT chart_id,jsonb_agg(jsonb_build_object(
    'id',id,'course',course,'side',side,'level',level,'branching',branching
  ) ORDER BY course,side,id) AS items FROM raw_difficulties GROUP BY chart_id
), records AS (
  SELECT b.id,b.nijiiro_id,b.title,b.title_translations,b.bpm,b.category_flags,b.status,
    COALESCE(d.items,'[]'::jsonb) AS difficulties,
    jsonb_build_object(
      'tja_reference',b.tja_file IS NOT NULL,'tja_record',t.id IS NOT NULL,
      'audio_reference',b.audio_file IS NOT NULL,'audio_record',a.id IS NOT NULL,
      'cover_reference',b.cover_file IS NOT NULL,'cover_record',c.id IS NOT NULL
    ) AS resources
  FROM base b LEFT JOIN difficulties d ON d.chart_id=b.id
    LEFT JOIN public.chart_resources t ON t.id=b.tja_file
    LEFT JOIN public.chart_resources a ON a.id=b.audio_file
    LEFT JOIN public.chart_resources c ON c.id=b.cover_file
)
SELECT jsonb_build_object(
  'connection',jsonb_build_object(
    'database',current_database(),'role',current_user,
    'transaction_read_only',current_setting('transaction_read_only'),
    'server_version',current_setting('server_version'),
    'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
    'table_privileges',(SELECT jsonb_agg(jsonb_build_object(
      'table',name,'select',has_table_privilege(current_user,'public.'||name,'SELECT'),
      'write',has_table_privilege(current_user,'public.'||name,'INSERT,UPDATE,DELETE,TRUNCATE')
    )) FROM unnest(ARRAY['charts','chart_difficulties','chart_resources']) AS names(name))
  ),
  'schema',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type)
    ORDER BY table_name,ordinal_position) FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('charts','chart_difficulties','chart_resources')),
  'difficulty_rows',(SELECT count(*) FROM raw_difficulties),
  'charts',COALESCE((SELECT jsonb_agg(to_jsonb(records) ORDER BY id) FROM records),'[]'::jsonb)
);
ROLLBACK;
"""


def read_postgres(container, database, role):
    # Pass no passwords or URLs through argv or diagnostics. The SQL is fixed
    # except for a validated role identifier. psql startup files are disabled.
    command = [
        "docker", "exec", "-i", "-e",
        "PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000",
        container, "sh", "-c",
        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "$1"',
        "catalog-audit", database,
    ]
    # Disk-backed capture avoids retaining unbounded subprocess output in RAM.
    with tempfile.TemporaryFile(dir="/var/tmp") as output, tempfile.TemporaryFile(dir="/var/tmp") as errors:
        result = subprocess.run(command, input=catalog_sql(role).encode(), stdout=output, stderr=errors, timeout=35)
        if result.returncode:
            raise RuntimeError(f"Read-only PostgreSQL query failed (exit {result.returncode}); no raw server diagnostics emitted")
        if output.tell() > MAX_BYTES:
            raise ValueError("PostgreSQL result exceeds 32 MiB")
        output.seek(0)
        data = json.load(output)
    validate_snapshot(data, role)
    return data


def validate_snapshot(data, expected_role):
    connection = data["connection"]
    privileges = {item["table"]: item for item in connection["table_privileges"]}
    if (connection["role"] != expected_role or connection["transaction_read_only"] != "on"
            or connection["superuser"] or any(
                table not in privileges or not privileges[table]["select"] or privileges[table]["write"]
                for table in REQUIRED_TABLES)):
        raise ValueError("PostgreSQL read-only role/transaction/privilege verification failed")
    if len(data["charts"]) > MAX_SONGS or data["difficulty_rows"] > MAX_DIFFICULTIES:
        raise ValueError("PostgreSQL catalog exceeds audit row limits; refusing a partial comparison")


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).casefold().split())


def valid_id(value):
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]+", str(value)):
        return None
    number = int(value)
    return number if number > 0 else None


def numeric(value):
    if isinstance(value, bool) or value is None or not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", str(value).strip()):
        return None
    number = float(value)
    return number if math.isfinite(number) and number > 0 else None


def names(chart):
    return {normalized(value) for value in [chart.get("title"), *(chart.get("title_translations") or {}).values()] if normalized(value)}


def shelf_status(song):
    value = song.get("shelf_status")
    return str(value) if value not in (None, "") else "0"


def compare_catalog(songs, snapshot):
    if not isinstance(songs, list) or len(songs) > MAX_SONGS or any(not isinstance(song, dict) for song in songs):
        raise ValueError("Viewer catalog must be an array of at most 20000 objects")
    charts = snapshot["charts"]
    by_id, by_title, viewer_ids = defaultdict(list), defaultdict(dict), defaultdict(list)
    issues, matches, unmatched, candidates = [], [], [], []

    def issue(code, severity, **details):
        issues.append({"code": code, "severity": severity, **details})

    for chart in charts:
        identity = valid_id(chart.get("nijiiro_id"))
        if identity:
            by_id[identity].append(chart)
        for name in names(chart):
            by_title[name][chart["id"]] = chart
        if chart.get("status") == "published":
            for kind in ("tja", "audio"):
                if not chart["resources"].get(f"{kind}_reference") or not chart["resources"].get(f"{kind}_record"):
                    issue("pg_resource_reference_missing", "warning", pg_id=chart["id"], resource=kind)
    for song in songs:
        identity = valid_id(song.get("id"))
        if identity:
            viewer_ids[identity].append(song)
        else:
            issue("viewer_invalid_id", "error", value=song.get("id"), title=song.get("song_name"))
    for identity, rows in viewer_ids.items():
        if len(rows) > 1:
            issue("viewer_duplicate_id", "error", viewer_id=identity, count=len(rows))
    for identity, rows in by_id.items():
        if len(rows) > 1:
            issue("pg_duplicate_nijiiro_id", "error", viewer_id=identity, pg_ids=[r["id"] for r in rows])

    compared_courses = 0
    for identity, rows in viewer_ids.items():
        if len(rows) != 1:
            continue
        song = rows[0]
        base = {"viewer_id": identity, "viewer_title": song.get("song_name"), "viewer_title_ja": song.get("song_name_jp"), "shelf_status": shelf_status(song)}
        pg_rows = by_id.get(identity, [])
        if len(pg_rows) != 1:
            unmatched.append(base)
            # Name equality is discovery evidence only, never an ID mapping.
            possible = {}
            for value in (song.get("song_name"), song.get("song_name_jp")):
                possible.update(by_title.get(normalized(value), {}))
            if possible:
                candidates.append({**base, "candidates": [
                    {"pg_id": item["id"], "nijiiro_id": item.get("nijiiro_id"), "title": item["title"]}
                    for item in possible.values()
                ]})
            continue
        chart = pg_rows[0]
        base.update(pg_id=chart["id"], pg_title=chart["title"])
        matches.append({**base, "status": chart.get("status")})
        viewer_names = {normalized(song.get(key)) for key in ("song_name", "song_name_jp") if normalized(song.get(key))}
        if not viewer_names.intersection(names(chart)):
            issue("id_matched_title_unconfirmed", "warning", **base, translations=chart.get("title_translations"))
        for locale, field in (("ja", "song_name_jp"), ("zh", "song_name")):
            value = (chart.get("title_translations") or {}).get(locale)
            if value and song.get(field) and normalized(value) != normalized(song[field]):
                issue("localized_title_difference", "info", **base, locale=locale, viewer=song[field], postgres=value)
        expected_bit = CATEGORY_BITS.get(song.get("type"))
        if expected_bit and not (int(chart.get("category_flags") or 0) & expected_bit):
            issue("category_difference", "warning", **base, viewer_category=song["type"], postgres_flags=chart.get("category_flags"))
        viewer_bpm, pg_bpm = numeric(song.get("bpm")), numeric(chart.get("bpm"))
        if viewer_bpm is not None and pg_bpm is not None:
            if not math.isclose(viewer_bpm, pg_bpm, rel_tol=0, abs_tol=0.000001):
                issue("bpm_difference", "warning", **base, viewer=song["bpm"], postgres=chart["bpm"])
        elif song.get("bpm") not in (None, "", "-"):
            issue("bpm_not_scalar_comparable", "info", **base, viewer=song.get("bpm"), postgres=chart.get("bpm"))
        if chart.get("status") != "published":
            issue("pg_matched_chart_not_published", "warning", **base, status=chart.get("status"))
        single = defaultdict(list)
        for difficulty in chart["difficulties"]:
            if difficulty["side"] == "single":
                single[difficulty["course"]].append(difficulty)
        for index, course in enumerate(COURSES, 1):
            level = numeric(song.get(f"level_{index}"))
            difficulties = single.get(course, [])
            if len(difficulties) > 1:
                issue("pg_duplicate_single_course", "error", **base, course=course)
            elif level is not None and not difficulties:
                issue("viewer_course_missing_in_pg", "warning", **base, course=course, viewer_level=level)
            elif level is None and difficulties:
                issue("pg_course_absent_in_viewer", "warning", **base, course=course, postgres_level=difficulties[0]["level"])
            elif level is not None and difficulties:
                compared_courses += 1
                if level != difficulties[0]["level"]:
                    issue("level_difference", "warning", **base, course=course, viewer=level, postgres=difficulties[0]["level"])

    field_presence = {key: sum(song.get(key) not in (None, "", [], {}) for song in songs)
                      for key in ("open_day", "version", "artists", "max_combo", "shelf_status", "roll_time", "roll_times", "balloons", "balloon_num")}
    counts = Counter(item["code"] for item in issues)
    return {
        "summary": {
            "viewer_songs": len(songs), "postgres_charts": len(charts),
            "postgres_difficulties": snapshot["difficulty_rows"],
            "postgres_with_nijiiro_id": sum(len(rows) for rows in by_id.values()),
            "postgres_without_nijiiro_id": sum(not valid_id(chart.get("nijiiro_id")) for chart in charts),
            "matched_by_nijiiro_id": len(matches), "viewer_unmatched_by_id": len(unmatched),
            "unmatched_with_exact_title_candidates": len(candidates),
            "postgres_nijiiro_ids_absent_in_viewer": len(set(by_id) - set(viewer_ids)),
            "single_courses_compared": compared_courses,
            "viewer_by_shelf_status": dict(sorted(Counter(shelf_status(song) for song in songs).items())),
            "unmatched_by_shelf_status": dict(sorted(Counter(item["shelf_status"] for item in unmatched).items())),
            "unmatched_without_exact_title_candidate": len(unmatched) - len(candidates),
            "unmatched_with_ambiguous_title_candidates": sum(len(item["candidates"]) > 1 for item in candidates),
            "unmatched_with_candidates_assigned_other_nijiiro_id": sum(
                any(candidate["nijiiro_id"] is not None for candidate in item["candidates"]) for item in candidates
            ),
            "resource_reference_coverage": {
                kind: sum(bool(chart["resources"].get(f"{kind}_reference")) and bool(chart["resources"].get(f"{kind}_record")) for chart in charts)
                for kind in ("tja", "audio", "cover")
            },
            "issue_song_counts": {code: len({item["viewer_id"] for item in issues if item["code"] == code and "viewer_id" in item}) for code in sorted(counts)},
            "issue_counts": dict(sorted(counts.items())),
            "severity_counts": dict(Counter(item["severity"] for item in issues)),
        },
        "viewer_fields_without_direct_pg_column": field_presence,
        "matches": matches, "viewer_unmatched": unmatched,
        "unmatched_title_candidates": candidates,
        "postgres_ids_absent_in_viewer": sorted(set(by_id) - set(viewer_ids)),
        "issues": issues,
    }


def markdown_report(report):
    summary = report["summary"]
    lines = [
        "# Viewer / PostgreSQL 只读曲库对照", "",
        f"生成时间：{report['generated_at']}。状态：{report['assessment']}。", "",
        f"JSON 来源：`{report['source']['song_data_path']}`。SHA-256：`{report['source']['sha256']}`。", "",
        f"PostgreSQL：`{report['connection']['database']}`；有效角色 `{report['connection']['role']}`；事务只读 `on`；三张曲库表均有 SELECT、无写入权限。", "",
        "只查询曲库、难度、资源元数据；不读取账号/个人成绩，不下载资源，不改变 Viewer 数据源。", "",
        "| 指标 | 数量 |", "|---|---:|",
    ]
    labels = {
        "viewer_songs": "Viewer 曲目", "postgres_charts": "PG 曲目", "postgres_difficulties": "PG 难度记录（含双人）",
        "postgres_with_nijiiro_id": "PG 有虹版 ID", "postgres_without_nijiiro_id": "PG 无虹版 ID",
        "matched_by_nijiiro_id": "按 Viewer ID = PG nijiiro_id 唯一匹配", "viewer_unmatched_by_id": "Viewer 按 ID 未匹配",
        "unmatched_with_exact_title_candidates": "未匹配曲目中存在同名候选", "postgres_nijiiro_ids_absent_in_viewer": "PG 虹版 ID 不在 Viewer",
        "single_courses_compared": "已对照单人难度星级",
    }
    lines += [f"| {label} | {summary[key]} |" for key, label in labels.items()]
    lines += ["", "## 上下架范围", "", "状态 0 为常规在架、1 为未实装/已下架、2 为其他歌曲（街机旧编号、主机独占等）。", "", "| 状态 | Viewer 数量 | 按 ID 未匹配 |", "|---|---:|---:|"]
    for status, count in summary["viewer_by_shelf_status"].items():
        lines.append(f"| {status} | {count} | {summary['unmatched_by_shelf_status'].get(status, 0)} |")
    lines += ["", "## 差异", "", "同名候选仅供人工核对；PG 内部 id 不作为 Viewer 曲目 ID。单人难度与双人 p1/p2 分开。星级 0、空白、`-` 视为无谱面。", "", "`id_matched_title_unconfirmed` 只表示按 ID 对齐后名称未能通过严格标准化确认，可能是标点、简繁体或版本后缀差异，不代表已证实串歌。", ""]
    for code, count in summary["issue_counts"].items():
        lines += [f"### {code}：{count}", ""]
        for item in [item for item in report["issues"] if item["code"] == code][:8]:
            lines.append("- " + json.dumps({key: value for key, value in item.items() if key not in ("code", "severity")}, ensure_ascii=False))
        lines.append("")
    lines += ["## 常规在架但按 ID 未匹配", ""]
    lines += ["- " + json.dumps(item, ensure_ascii=False) for item in report["viewer_unmatched"] if item["shelf_status"] == "0"]
    lines += ["", "## 按 ID 未匹配的其他样例", ""]
    lines += ["- " + json.dumps(item, ensure_ascii=False) for item in report["viewer_unmatched"][:15]]
    lines += ["", "## 同名候选样例（不自动关联）", ""]
    lines += ["- " + json.dumps(item, ensure_ascii=False) for item in report["unmatched_title_candidates"][:10]]
    lines += ["", "## 字段覆盖缺口", "", "以下 JSON 字段在 PG 当前曲库表中没有直接对应列；数值为 JSON 中非空记录数。未推断其他表或外部资源能否补齐。", ""]
    lines += [f"- `{field}`：{count}" for field, count in report["viewer_fields_without_direct_pg_column"].items()]
    lines += ["", "## 资源引用覆盖", "", "分母为全部 PG 曲目；只验证引用能关联到资源记录，不证明对象文件可用。", ""]
    lines += [f"- `{kind}`：{count}/{summary['postgres_charts']}" for kind, count in summary["resource_reference_coverage"].items()]
    lines += ["", "## 核查边界", "", "- 名称只作 Unicode NFKC、大小写和空白标准化，不做模糊匹配。", "- 分类按现有 category_flags 位映射核对；BPM 只比较标量，范围不强行转换。", "- 资源仅核对引用与数据库记录；未验证实际 TJA/音频/封面对象可下载。", "- 未核对 Rating、称号、个人历史、账号、论坛，也未验证切换后的页面性能。", "- 只读角色由既有容器登录会话 SET LOCAL ROLE 切换；不是新增 Viewer 常驻连接。", "- 所有明细保存在同目录 report.json。", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--song-data", help="Explicit public song_data.json; default resolves the running Viewer service")
    parser.add_argument("--viewer-service", default="taiko-viewer.service")
    parser.add_argument("--pg-container", default="ourtaiko-database-postgres")
    parser.add_argument("--pg-database", default="ourtaiko_database")
    parser.add_argument("--pg-role", default="ourtaiko_database_viewer")
    parser.add_argument("--output-dir", required=True, help="Use a new disk-backed /var/tmp directory")
    args = parser.parse_args()
    output = Path(args.output_dir).resolve()
    if output == Path("/var/tmp") or Path("/var/tmp") not in output.parents:
        parser.error("--output-dir must be a subdirectory of /var/tmp")
    if output.exists():
        parser.error("--output-dir must be new; existing audit artifacts are preserved")
    path, provenance = viewer_source(args.song_data, args.viewer_service)
    songs, fingerprint = bounded_json(path)
    snapshot = read_postgres(args.pg_container, args.pg_database, args.pg_role)
    report = compare_catalog(songs, snapshot)
    _, after = bounded_json(path)
    if after != fingerprint:
        raise ValueError("Viewer JSON changed during the PostgreSQL comparison; rerun")
    report.update(
        generated_at=datetime.now(timezone.utc).isoformat(),
        assessment="differences_found" if report["issues"] or report["viewer_unmatched"] else "compared_fields_agree",
        source={**provenance, "song_data_path": str(path), "sha256": fingerprint},
        connection=snapshot["connection"], postgres_schema=snapshot["schema"],
        scope="offline_readonly_catalog_comparison_no_runtime_switch",
    )
    content = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if len(content.encode()) > MAX_BYTES:
        raise ValueError("Audit report exceeds 32 MiB")
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    (output / "report.json").write_text(content, encoding="utf8")
    (output / "report.md").write_text(markdown_report(report), encoding="utf8")
    print(json.dumps({"assessment": report["assessment"], "summary": report["summary"], "report_directory": str(output)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        raise SystemExit(f"Catalog audit failed: {error}") from None
