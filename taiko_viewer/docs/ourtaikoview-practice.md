# Song practice

- Song detail reuses the chart-preview cards when `tjaBundleUrl` is available.
- `/ourtaikoview/{id}/{difficulty}` uses Viewer difficulty IDs 1–5 (Easy, Normal, Hard, Oni, Edit). It checks that the requested course actually exists before starting the player.
- The browser downloads the existing `/api/content/songs/{id}/tja-package` ZIP. It decodes the TJA as UTF-8 (Shift-JIS fallback), then extracts the exact WAVE basename packed by that endpoint. It does not call a separate practice API. ZIP download, chart and audio sizes are bounded; decompression is cancellable.
- Player code and the song ZIP start downloading in parallel. Either may become ready first; the chart is sent exactly once after both are ready. Retry and navigation discard the old frame and abort its work.
- `PracticePlayerPage` is excluded from the app-wide KeepAlive cache so leaving really unmounts it, releases the audio bundle and listener, and returning creates a fresh player. A route-level `keepalive: false` alone would be overridden by the existing `NuxtPage` prop.
- `public/practice-player/release.json` pins a reviewed upstream release and its SHA-256 file inventory. The frame revalidates this local manifest (no timestamp cache busting); `/ourtaikoview-manifest.json` redirects to it for older clients. No playback request proxies to Fanmade.
- `/ourtaikoview-runtime/<version>/...` streams files from `/var/lib/taiko/practice-player` (override: `TAIKO_PRACTICE_PLAYER_DIR`). Only files in the version's validated inventory are served; traversal and escaping symlinks are rejected. Versioned resources have one-year immutable caching and ETags. Unity's `.unityweb` decompression remains in its loader; no fabricated Content-Encoding is sent.
- The manifest/runtime fetches retry transient network/408/429/5xx failures once. The loader script retries once with a 20-second deadline per attempt. Fetches have 60-second deadlines, and the parent retains its overall 180-second load deadline. There is no repeated Unity initialization loop. Failure messages distinguish bundle download, player download/startup, and chart/audio preparation.
- `/practice-player/index.html` loads the resolved Unity build and adapts the ZIP audio Blob to the runtime's HTTP-only audio contract. The host sends chart text, audio Blob/type, course and practice mode by postMessage after `ready`, plus `setDrumVolume` (built-in hit sounds, 0–100). The adapter serves exactly one virtual HTTP URL through its frame-local fetch; all other fetches pass through normally. No upload or new backend is involved. Both the iframe source and origin are checked. Loading times out; retry/unmount aborts pending requests, unloads the player and releases the audio/frame.

## Validation and release

Run `bash scripts/memory/run_qa.sh /absolute/path/to/node --experimental-strip-types --test taiko_viewer/tests/ourTaikoView.test.ts taiko_viewer/tests/practiceBundle.test.ts taiko_viewer/tests/practiceBundleFetch.test.mjs taiko_viewer/tests/practicePlayer.test.mjs` from the repository root. Sync tests cover hash failures, interrupted download recovery, immutable publication, last-good retention, offline reuse and concurrency locking. HTTP tests cover streaming, HEAD, ETags and path boundaries.

Run `bash scripts/memory/run_qa.sh /absolute/path/to/node taiko_viewer/scripts/verify_practice_player.mjs` for bounded local browser QA. It owns a temporary Nuxt dev server on port 3197, forwards browser API GETs to the existing local service on port 3100, and uses a real song ZIP. It blocks the upstream player host, injects transient failures, exercises real Unity loading/start, volume control, manual reload, missing-course/bundle/player failures and navigation cleanup. Artifacts are stored in `/var/tmp/practice-player-qa`. It closes the browser and stops its server in finally. Human validation remains appropriate for audible sound, keyboard feel and fullscreen on actual devices.

The standard isolated release must use `scripts/memory/run_build.sh` with `scripts/deploy_forum_web.sh` and the release HEAD subject. After release, pass `https://viewer.sakura-bot.cn` as the browser script's argument for read-only online smoke without injected failures or a dev server.

## Player resource updates and rollback

Unity build outputs stay outside Git and the Viewer build. Only the small release inventory is tracked. Provision the same resource directory on every serving host before releasing a new pin.

1. Retrieve the upstream `https://fanmade.ourtaiko.org/player-build.json` as a candidate inventory outside Git. Review the file list, version and hashes. Include every listed `StreamingAssets` file; the current release lists only its four Build files and index.html and needs no separate StreamingAssets files.
2. Run `bash scripts/memory/run_qa.sh /absolute/path/to/node taiko_viewer/scripts/sync_practice_player.mjs /absolute/path/to/candidate.json [storage-directory]`. Omit the manifest argument to provision the checked-in pin. Downloads stream to a staging directory, are size/time bounded and SHA-256 checked, and retry once. Only a fully verified directory is renamed into place. Existing versions are never overwritten or removed; an existing version is rehashed for offline reuse. Failed syncs leave the serving version unchanged.
3. Copy the candidate to `public/practice-player/release.json` only as a proposed source change, run local playback QA, and release the reviewed pin with the normal Viewer version bump/deploy. A successful sync alone never changes the version selected by users. If validation fails, retain the previous pin.
4. To roll back a player update, restore the prior inventory, bump the Viewer patch version and release normally. Retain previous version directories so active sessions and rollbacks continue to work. No background auto-update or automatic deletion runs.

The sync lock is `<storage-directory>/.sync-lock`. If a process was killed, inspect that no sync is running before removing the stale lock and its abandoned `.staging-*` directory. Never remove published version directories as part of lock cleanup.

### Safari Ogg compatibility (0.81.5)

Practice feature-detects `audio/ogg; codecs="vorbis"`. Unsupported browsers (including iOS 18.3.2 Safari) request `tja-package?audio=wav`. Only that variant converts Ogg to stereo 44.1 kHz PCM WAV and rewrites the ZIP's WAVE field; source files and ordinary downloads are unchanged. WAV avoids MP3 encoder delay in rhythm timing.

The server requires `/usr/bin/ffmpeg`. Conversion uses one thread, a 60-second deadline, 128 MiB input and 120 MiB output limits. Each Node process admits one conversion/stream at a time (busy requests receive 503), with no waiting queue or retained cache. Temporary directories under `/var/tmp/taiko-practice-audio-*` are removed on completion, cancellation or failure. Abrupt host/process termination can leave a directory for operational cleanup.

Run `verify_practice_player.mjs --wav` through the memory QA wrapper to test real song 1357 with Ogg capability disabled and Ogg decoding rejected. This exercises the fallback in Chromium; it does not replace physical iPhone verification.

### Software audio decoding (0.81.8)

The practice page now sends transferable encoded audio bytes to the pinned player `2ec933fb07d8bd7b`. It first requests native decoding, then retries `AUDIO_DECODE_FAILED` exactly once with a new request ID and `audioDecode: software`, using the retained Blob without downloading another bundle. The iframe stays mounted throughout the retry. Retry data is released after loading or on exit, cancellation and errors.

The new player's `audio/` Worker, decoder libraries, source maps and license notices are included in the SHA-256 manifest and served from the same local versioned runtime as Unity. The sync tool preserves raw CDN gzip bytes for hash verification; the local runtime leaves Unity's decompressor responsible for `.unityweb`. Browsers do not contact CloudFront during practice.

The `?audio=wav` endpoint remains available for rollback while physical iPhone acceptance is pending; ordinary practice no longer requests it. Run `verify_practice_player.mjs --software` (with `TAIKO_REPO_ROOT` pointing at the content repository for local QA) via the memory wrapper. It forces native Ogg rejection and checks native → software, one bundle download, local Worker loading, fullscreen fallback and lifecycle recovery. Software PCM still consumes device memory; no streaming-audio or physical-device performance guarantee is implied.

`verify_practice_audio_decode.mjs` checks 5-minute stereo Vorbis through the actual pinned native/software adapters, including sample-aligned onset and complete duration. The test host Chromium adds about 15 ms of native tail padding; software decoding returns the exact 300-second source. This host result is not an iPhone latency/memory measurement.
