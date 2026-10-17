The legacy Bot save caller delegates explicitly admitted Sources to the pinned
installed Taiko 0.14.2 Writer. The dispatcher service uses that same installed
package directly; its old userid-only mutation endpoints are retired. Viewer
already uses its authenticated Source coordinator for sync and token mutations.
No snapshot/fact algorithm or Publication storage is implemented here.

The Bot caller's root-owned admission file is
`/var/lib/taiko/viewer-rollout/source-ingress.json`. Credentials remain in the
existing protected environment file. Invalid policy or a failed delegated write
fails closed instead of falling back to the legacy Writer. Other Bot Sources
retain their original save behavior.

Before first canonical adoption, the Bot must load the delegated save caller and
the installed dispatcher must be active. Adopt existing bytes only through the
installed kernel's backup/adoption operation under EX; preserve its sequence-zero
meaning. Do not manufacture a play event or change the original bytes.

The BFF and private v1 reads reject an incompatible legacy projection. Linked
projections need metadata checks; adopted copies are stream-hashed without a
second JSON decode. The request compares projection fingerprints again before
returning, so an out-of-kernel mutation cannot justify returning stale data.

Rollback removes users/clients from their separate read admission files. Keep
Writer admission for already adopted Sources so later Bot updates continue to
use their committed Publication. Code rollback does not restore old SQL/files.
