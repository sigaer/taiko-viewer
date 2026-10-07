# Song practice

- Song detail reuses the chart-preview cards when `tjaBundleUrl` is available.
- `/ourtaikoview/{id}/{difficulty}` uses Viewer difficulty IDs 1–5 (Easy, Normal, Hard, Oni, Edit). It checks that the requested course actually exists before starting the player.
- The browser downloads the existing `/api/content/songs/{id}/tja-package` ZIP. It decodes the TJA as UTF-8 (Shift-JIS fallback), then extracts the exact WAVE basename packed by that endpoint. It does not call a separate practice API. ZIP download, chart and audio sizes are bounded; decompression is cancellable.
- Each player frame fetches the public Fanmade `/player-build.json` through `/ourtaikoview-manifest.json` without caching. It validates the path and keeps that version for the entire session. Nitro proxies `/ourtaikoview-runtime/**` to Fanmade `/player/**`; no specific build hash or Unity output is stored here.
- `/practice-player/index.html` loads the resolved Unity build and adapts the ZIP audio Blob to the runtime's HTTP-only audio contract. The host sends chart text, audio Blob/type, course and practice mode by postMessage after `ready`, plus `setDrumVolume` (built-in hit sounds, 0–100). The adapter serves exactly one virtual HTTP URL through its frame-local fetch; all other fetches pass through normally. No upload or new backend is involved. Both the iframe source and origin are checked. Loading times out; retry/unmount aborts pending requests, unloads the player and releases the audio/frame.

## Validation and release

Run `bash scripts/memory/run_qa.sh /absolute/path/to/node --experimental-strip-types --test taiko_viewer/tests/ourTaikoView.test.ts taiko_viewer/tests/practiceBundle.test.ts taiko_viewer/tests/practiceBundleFetch.test.mjs` from the repository root on its supported Linux host. Also verify a real song with and without a TJA package, all available courses including Edit, audible music/hit sounds, volume, fullscreen, retry and navigation cleanup.

The local development API proxy forwards the existing ZIP download to production; no new production endpoint is required. The standard isolated release must use `scripts/memory/run_build.sh` with `scripts/deploy_forum_web.sh` and the release HEAD subject.

On the current macOS checkout, the required cgroup/systemd QA wrapper is unavailable. Automated tests, runtime availability and browser playback remain unverified.
