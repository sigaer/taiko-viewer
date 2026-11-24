#!/bin/bash
set -euo pipefail
cd /var/tmp/taiko-batch21-20261124/viewer/taiko_viewer
export PATH=/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin:$PATH
export NUXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=4096
exec npm run build
