#!/usr/bin/env bash
# Run once on the production host with a dedicated Actions public key.
set -euo pipefail
if [[ "$EUID" -ne 0 || $# -ne 1 ]]; then
  echo "Usage (root): bash scripts/release/install-viewer-ci-ssh.sh <ed25519-public-key-file>" >&2
  exit 2
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ "$root" != /home/sigaer/taiko/taiko-forum ]]; then
  echo "Install from the production checkout after the workflow change is merged." >&2
  exit 1
fi
ssh-keygen -lf "$1" >/dev/null
read -r key_type public_key _ < "$1"
[[ "$key_type" == ssh-ed25519 && "$public_key" =~ ^[A-Za-z0-9+/]+={0,2}$ ]]
install -m 0755 "$root/scripts/release/viewer-ci-ssh-entry.sh" /usr/local/libexec/taiko-viewer-ci-ssh
install -d -m 0700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 0600 /root/.ssh/authorized_keys
entry="restrict,command=\"/usr/local/libexec/taiko-viewer-ci-ssh\" $key_type $public_key taiko-viewer-actions"
if ! grep -Fxq "$entry" /root/.ssh/authorized_keys; then
  printf '\n%s\n' "$entry" >> /root/.ssh/authorized_keys
fi
echo "Restricted Viewer deployment key installed. Existing login keys were preserved."
