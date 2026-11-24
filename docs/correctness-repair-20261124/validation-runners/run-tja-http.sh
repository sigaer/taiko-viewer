set -euo pipefail
source_root="$1/taiko_viewer"
export PATH=/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin:$PATH
node "$source_root/scripts/prepare_tja_runtime.mjs"
# The worker has PrivateTmp=yes: runtime must live outside /var/tmp.
fixture_root="$QA_RUN_TMPDIR/viewer"
mkdir -p "$fixture_root/tests" "$fixture_root/assets/data"
cp -a "$source_root/server" "$source_root/types" "$source_root/.tja-runtime" "$fixture_root/"
cp "$source_root/tests/tjaCalculator.test.mjs" "$fixture_root/tests/"
cp "$source_root/assets/data/v2_console_constants.json" "$fixture_root/assets/data/"
cp "$source_root/package.json" "$fixture_root/"
ln -s "$source_root/node_modules" "$fixture_root/node_modules"
node --test "$fixture_root/tests/tjaCalculator.test.mjs"
