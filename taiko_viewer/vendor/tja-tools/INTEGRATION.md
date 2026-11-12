This directory contains byte-identical files from
https://github.com/WHMHammer/tja-tools at the commit in `sources.json`.
The upstream package declares MIT; its author/contributor information and
acknowledgements are retained in `package.json` and `README.md`.

`prepare_tja_runtime.mjs` verifies Git blob hashes before bundling. The image
adapter imports the parser and renderer only, provides the number formatter
from the pinned application entry, and adapts webpack sprite imports for
esbuild. No interactive application dependencies or remote fonts are loaded.

Display titles come from the catalog's Chinese name with an original-name
fallback, or the image job's explicit `title`. Source TJA bytes stay unchanged.
The adapter adds no watermark. Existing chart-maker metadata is preserved.
