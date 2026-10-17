This compatibility caller delegates the selected Sources of the legacy Bot save
and dispatcher save to the pinned installed Taiko 0.14.2 Writer. It does not
implement snapshot diffs, facts, locks, measurements or Publication storage.

Production admission lives in the root-owned
`/var/lib/taiko/viewer-rollout/source-ingress.json`. It contains only the selected
Source identities and fixed runtime paths. Credentials remain in the existing
protected environment file. Invalid policy or a failed delegated write fails
closed instead of falling back to the legacy Writer.

Before first canonical adoption, both live save callers must load the caller
and pass the targeted isolated write/read test. Adopt existing bytes only through
the installed kernel's existing backup/adoption operation under EX; preserve
its sequence zero meaning. Do not manufacture a new play event or alter bytes.

Rolling back the My Taiko read rollout removes users from its separate allowlist.
Keep the delegated Writer admission for already adopted Sources so later Bot
updates cannot silently bypass their committed Publication. A code rollback does
not restore old SQL or user files.
