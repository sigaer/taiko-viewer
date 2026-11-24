set -euo pipefail
cd /var/tmp/taiko-correctness-20261124/integration/taiko_viewer
export PATH=/opt/taiko-viewer-runtime/node-v24.22.1-linux-x64/bin:$PATH
export NUXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=4096
npm run build
