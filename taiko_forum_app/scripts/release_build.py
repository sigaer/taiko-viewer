#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBSPEC_PATH = ROOT / "pubspec.yaml"
VERSION_RE = re.compile(r"^(version:\s*)(\d+)\.(\d+)\.(\d+)\+(\d+)\s*$", re.MULTILINE)
VALID_BUMP_PARTS = {"auto", "build", "patch", "minor", "major"}


def load_pubspec() -> str:
    if not PUBSPEC_PATH.exists():
        raise FileNotFoundError(f"pubspec.yaml not found: {PUBSPEC_PATH}")
    return PUBSPEC_PATH.read_text(encoding="utf-8")


def parse_version(content: str) -> tuple[re.Match[str], tuple[int, int, int, int]]:
    match = VERSION_RE.search(content)
    if not match:
        raise ValueError("Unable to find a valid `version: x.y.z+build` line in pubspec.yaml")
    major, minor, patch, build = (int(match.group(index)) for index in range(2, 6))
    return match, (major, minor, patch, build)


def format_version(version: tuple[int, int, int, int]) -> str:
    major, minor, patch, build = version
    return f"{major}.{minor}.{patch}+{build}"


def bump_version(
    version: tuple[int, int, int, int],
    bump_part: str,
) -> tuple[int, int, int, int]:
    major, minor, patch, build = version
    if bump_part == "build":
        return major, minor, patch, build + 1
    if bump_part == "patch":
        return major, minor, patch + 1, build + 1
    if bump_part == "minor":
        return major, minor + 1, 0, build + 1
    if bump_part == "major":
        return major + 1, 0, 0, build + 1
    raise ValueError(f"Unsupported bump part: {bump_part}")


def infer_bump_part(summary: str) -> str:
    normalized = summary.strip().lower()
    if not normalized:
        return "build"

    major_keywords = (
        "breaking",
        "break change",
        "重大重构",
        "不兼容",
        "协议变更",
        "接口重构",
        "schema break",
        "数据迁移",
        "迁移到",
    )
    minor_keywords = (
        "新增",
        "增加",
        "支持",
        "加入",
        "feature",
        "new screen",
        "new api",
        "新页面",
        "新功能",
        "新接口",
        "新入口",
        "新设置",
    )
    patch_keywords = (
        "修复",
        "fix",
        "bug",
        "优化",
        "调整",
        "兼容",
        "改进",
        "回归",
        "问题",
        "提示",
        "崩溃",
    )

    if any(keyword in normalized for keyword in major_keywords):
        return "major"
    if any(keyword in normalized for keyword in minor_keywords):
        return "minor"
    if any(keyword in normalized for keyword in patch_keywords):
        return "patch"
    return "build"


def resolve_flutter_bin() -> str:
    preferred = Path("/opt/flutter/bin/flutter")
    if preferred.exists():
        return str(preferred)
    detected = shutil.which("flutter")
    if detected:
        return detected
    raise FileNotFoundError("Flutter binary not found. Expected /opt/flutter/bin/flutter or `flutter` in PATH.")


def main(argv: list[str]) -> int:
    dry_run = False
    bump_part = "auto"
    summary = ""
    passthrough_args: list[str] = []
    index = 1
    while index < len(argv):
        arg = argv[index]
        if arg == "--dry-run":
            dry_run = True
        elif arg == "--bump":
            index += 1
            if index >= len(argv):
                raise ValueError("Expected one of: auto, build, patch, minor, major")
            bump_part = argv[index]
        elif arg.startswith("--bump="):
            bump_part = arg.split("=", 1)[1]
        elif arg == "--summary":
            index += 1
            if index >= len(argv):
                raise ValueError("Expected release summary text after --summary")
            summary = argv[index]
        elif arg.startswith("--summary="):
            summary = arg.split("=", 1)[1]
        else:
            passthrough_args.append(arg)
        index += 1

    if bump_part not in VALID_BUMP_PARTS:
        raise ValueError(
            f"Invalid bump part `{bump_part}`. Expected one of: {', '.join(sorted(VALID_BUMP_PARTS))}"
        )

    inferred_bump_part = infer_bump_part(summary)
    if bump_part == "auto":
        bump_part = inferred_bump_part

    original_content = load_pubspec()
    match, current_version = parse_version(original_content)
    next_release_version = bump_version(current_version, bump_part)
    updated_content = (
        original_content[: match.start()]
        + f"{match.group(1)}{format_version(next_release_version)}"
        + original_content[match.end() :]
    )

    flutter_bin = resolve_flutter_bin()
    command = [flutter_bin, "build", "apk", "--release", *passthrough_args]

    print(f"Current version : {format_version(current_version)}")
    if summary:
        print(f"Release summary : {summary}")
        print(f"Inferred bump   : {inferred_bump_part}")
    print(f"Bump part       : {bump_part}")
    print(f"Next version    : {format_version(next_release_version)}")
    print(f"Build command   : {' '.join(command)}")

    if dry_run:
        print("Dry run only. pubspec.yaml was not modified.")
        return 0

    PUBSPEC_PATH.write_text(updated_content, encoding="utf-8")
    try:
        subprocess.run(command, cwd=ROOT, check=True)
    except BaseException as exc:
        PUBSPEC_PATH.write_text(original_content, encoding="utf-8")
        print(
            f"Build failed. Restored pubspec version to {format_version(current_version)}.",
            file=sys.stderr,
        )
        if isinstance(exc, subprocess.CalledProcessError):
            return exc.returncode
        raise

    print(f"Build succeeded. Version updated to {format_version(next_release_version)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
