"""Keep generated captures in the bounded runner/vault, outside the repository."""
import os
from pathlib import Path

def review_output():
    value = os.environ.get('VIEWER_REVIEW_OUT') or os.environ.get('QA_EVIDENCE_DIR')
    if not value:
        raise RuntimeError('Use run_qa.sh and an optional persistent VIEWER_REVIEW_OUT vault directory')
    out = Path(value).resolve()
    repo = Path(__file__).resolve().parents[3]
    if out == repo or repo in out.parents:
        raise RuntimeError('Generated QA evidence must be outside the source checkout')
    out.mkdir(mode=0o700, parents=True, exist_ok=True)
    return out
