# A — Viewer recommendation contract

Native A supplied design/review; lead executed changes. Viewer resolver formerly mapped 大歌力 to daigouryoku, which Application projection rejects, and did not accept public big_song. The extracted pure resolver now emits public big_song for these aliases. Bot/Application changes live in the companion Bot candidate and translate to Core only at computation boundaries.

`tests/recommendationDimensions.test.mjs`: PASS via run_qa.sh with production Node 24.22.1. Bot synthetic seven-dimension checks pass on installed Core 0.1.1 and source 0.1.2. Version is candidate 1.19.8, not a published release. No visible copy added.
