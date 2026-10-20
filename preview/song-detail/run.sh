#!/usr/bin/env bash
set -euo pipefail
preview_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$preview_dir/../.." && pwd)"
node_binary="${SONG_PREVIEW_NODE:-/www/server/nvm/versions/node/v24.13.0/bin/node}"
if [ ! -f "$repo_dir/taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs" ]; then
  echo 'Use this checkout’s existing Viewer dependencies before starting the preview.' >&2
  exit 1
fi
if [ ! -e "$preview_dir/node_modules" ]; then ln -s ../../taiko_viewer/node_modules "$preview_dir/node_modules"; fi
if [ ! -e "$repo_dir/taiko_viewer/.nuxt" ] && [ ! -L "$repo_dir/taiko_viewer/.nuxt" ]; then ln -s ../preview/song-detail/.nuxt "$repo_dir/taiko_viewer/.nuxt"; fi
: > "$preview_dir/.env.preview-empty"
cd "$repo_dir"
exec bash scripts/memory/run_dev.sh "$node_binary" "$repo_dir/taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs" dev "$preview_dir" --host 127.0.0.1 --port 3208 --no-fork --dotenv "$preview_dir/.env.preview-empty"
