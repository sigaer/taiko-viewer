"""Bounded, offline single-file calculator. stdin/stdout only; never store uploads."""
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'Constants/src'))
from tja_analysis import Chart, ChartRatings, TJAChartAnalyzer
from rating import RatingPipeline
from computing_parameters import load_computing_parameters
import algorithms


def calculate(data, node, encoding='auto'):
    if not data or len(data) > 512 * 1024:
        raise ValueError('file_size')
    choices = ['utf-8-sig', 'cp932', 'gb18030'] if encoding == 'auto' else [encoding]
    for codec in choices:
        try:
            text = data.decode(codec).lstrip('\ufeff')
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError('encoding')
    if '\0' in text or not re.search(r'^\s*#START(?:\s|$)', text, re.M) or not re.search(r'^\s*#END\s*(?://.*)?$', text, re.M):
        raise ValueError('invalid_tja')
    if len(re.findall(r'^\s*#START(?:\s|$)', text, re.M)) > 12:
        raise ValueError('chart_limit')
    inside = False
    for line in text.splitlines():
        command = line.split('//', 1)[0].strip()
        if re.match(r'^#START(?:\s|$)', command):
            if inside:
                raise ValueError('invalid_tja')
            inside = True
        elif command == '#END':
            if not inside:
                raise ValueError('invalid_tja')
            inside = False
    if inside:
        raise ValueError('invalid_tja')
    parsed = subprocess.run([node, '--max-old-space-size=128', str(ROOT / 'analyze.mjs')],
                            input=text, text=True, capture_output=True, timeout=10)
    if parsed.returncode or len(parsed.stdout) > 8 * 1024 * 1024:
        raise ValueError('invalid_tja')
    raw = json.loads(parsed.stdout)
    pipeline = RatingPipeline(load_computing_parameters(ROOT / 'Constants/cached_computing_parameters.json'))
    charts = []
    for course, branches in raw.get('courses', {}).items():
        for branch, gaps in branches.items():
            if len(charts) >= 36:
                raise ValueError('chart_limit')
            types = raw.get('noteTypes', {}).get(course, {}).get(branch, [])
            intervals = TJAChartAnalyzer.extract_intervals(gaps)
            item = {'course': course, 'branch': branch, 'totalNotes': len(types)}
            if len(types) < 2:
                charts.append({**item, 'error': 'too_few_notes'})
                continue
            if len(types) > 20000:
                raise ValueError('note_limit')
            if len(intervals) != len(types) - 1 or any(t not in (1, 2) for t in types) or any(not math.isfinite(x) for x in intervals):
                charts.append({**item, 'error': 'note_alignment'})
                continue
            try:
                # Assign directly: upstream calculate_raw_ratings suppresses algorithm errors.
                ratings = ChartRatings(total_notes=len(types))
                _, _, ratings.stamina = algorithms.calculate_result(intervals)
                ratings.complex, ratings.complex_ratio = algorithms.calculate_complete_compound_difficulty(intervals, types)
                ratings.rhythm, ratings.rhythm_ratio = algorithms.compute_final_rhythm_difficulty(intervals)
                ratings.speed = algorithms.compute_speed(intervals)
                ratings.burst = algorithms.compute_burst(intervals)
                ratings.roll_equivalent, ratings.roll_equivalent_outputs = TJAChartAnalyzer.calc_roll_equivalent(intervals, types)
                values = pipeline.compute_all([Chart(course=course, branch_type=branch, ratings=ratings)])[0].as_dict()
                if any(not isinstance(v, (float, int)) or not math.isfinite(v) for v in values.values()):
                    raise ValueError('non_finite')
                charts.append({**item, 'constants': values, 'raw': {k: v for k, v in ratings.to_dict().items() if k != 'rollEquivalentOutputs'}})
            except Exception:
                charts.append({**item, 'error': 'calculation_failed'})
    if not charts:
        raise ValueError('invalid_tja')
    title = re.search(r'^TITLE\s*:(.*)$', text, re.M | re.I)
    return {'title': title.group(1).strip()[:200] if title else '', 'encoding': codec, 'charts': charts,
            'model': 'ourtaiko-v2-62a3a597',
            'calibrationSha256': hashlib.sha256((ROOT / 'Constants/cached_computing_parameters.json').read_bytes()).hexdigest()}


if __name__ == '__main__':
    try:
        result = calculate(sys.stdin.buffer.read(512 * 1024 + 1), sys.argv[1], sys.argv[2])
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except subprocess.TimeoutExpired:
        print(json.dumps({'error': 'timeout'}))
    except (ValueError, UnicodeError) as exc:
        code = str(exc)
        print(json.dumps({'error': code if code in ('file_size', 'encoding', 'invalid_tja', 'chart_limit', 'note_limit') else 'invalid_tja'}))
