"""Render boundary only: observe business rows; execute the real Web Python code.

The executable trampoline is owned by the SQL fixture. Never used by production.
"""
import json
import os
import runpy
import sys
from pathlib import Path

from taiko_application.query import RecommendationContext
from taiko_application.query.recommendation import project_ordinary_recommendations
from taiko_bot.offline import viewer


def observe(rows, **kwargs):
    payload = project_ordinary_recommendations(RecommendationContext(rows=rows, basis="rating"))
    Path(os.environ["RATING_ENTRY_CAPTURE"]).write_text(json.dumps(payload))
    # Rendering and JPEG conversion remain bounded; no fonts/assets or OCR needed.
    from PIL import Image
    from io import BytesIO
    with Image.new("RGB", (2, 2)) as image:
        with BytesIO() as output:
            image.save(output, format="PNG")
            return output.getvalue()


viewer.generate_recommend_image = observe
args = sys.argv[1:]
assert args.pop(0) == "-I"
mode = args.pop(0)
name = args.pop(0)
sys.argv = [name, *args]
if mode == "-c":
    exec(compile(name, "<actual-web-worker>", "exec"))
else:
    assert mode == "-m"
    runpy.run_module(name, run_name="__main__")
