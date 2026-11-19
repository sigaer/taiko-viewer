#!/usr/bin/env bash
# Install outside the checkout, and bind the CI public key to this forced command.
set -euo pipefail
if [[ ! "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo "Only deploy <40-character main commit SHA> is accepted." >&2
  exit 2
fi
commit="${BASH_REMATCH[1]}"
cd /home/sigaer/taiko/taiko-forum
export PATH=/www/server/nvm/versions/node/v24.13.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
unset NODE_TLS_REJECT_UNAUTHORIZED
exec /bin/bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh --ci "$commit"
