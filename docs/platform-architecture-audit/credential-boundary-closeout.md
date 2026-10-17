# Credential boundary closeout — 2026-10-16

**Application source remediation is verified locally; Credential Gate remains BLOCKED.**
The earlier anonymous-writer FAIL at Sakura `63be19a` is retained. No production
reachability, exploit, configuration change or credential access is claimed.

## Reviewed candidates

- Sakura `0b82e0b2e01c155e7c50ea57c0ebd385633a45d0`, isolated tree
  `/var/tmp/sakura-credential-control-plane-20261016`.
- Taiko public API counterpart `3ad6add`, combined with the G1 source change in
  `/var/tmp/taiko-082-closeout-20261016` at `b2081ec`. The existing installed
  `0.14.1` wheel is unchanged and does not contain these fixes.
- The two standard-library control modules have identical SHA-256
  `c63f99384022e74a1029416c30d49698b91eb674d619fa7be3a930c577492ac6`.
  Neither module imports the other repository. Sakura retains an explicitly
  reviewed legacy host copy; the future Taiko artifact owns its installed service.

Both credential handlers now require an actually HMAC-verified, short-lived service
JWT before reaching a writer. Exact issuer, audience, subject, scope, configured
singleton owner and body hash are checked. Revoked/expired clients, missing private
configuration, unknown owner, forged signature, malformed payload and replay fail
closed. A private cross-process lock and durable nonce reservation precede writes;
failed writes consume the nonce and require explicit new authorization. Private
responses use no-store, payload reads are bounded and credential diagnostics are
sanitized. The request cannot choose an arbitrary destination or owner.

The uploaded Wahlap JWT is an opaque credential payload. Its upstream signature
cannot be verified with a key the platform does not possess; its decoded ID/expiry
are consistency checks, never the authorization proof. The operator's verified
service signature authorizes the exact captured bytes for a preconfigured owner.
Developer tokens are not accepted as grants.

## Legitimate consumers and rollout constraint

The tracked `/api/token` inventory found no caller. The miku route has a real Surge
response script consumer. It is retained but defaults to no upload without an
explicit one-use signed envelope. The accompanying private-config/stdin CLI can
send a captured credential or produce an envelope valid for 45 seconds for the
same exact token. No service key is embedded in browser/Surge code, and no anonymous
signing relay or new daemon is introduced. This is an intentional compatibility
change; existing automatic uploads need operator migration.

Before any activation, deploy the reviewed consumer protocol and service policy as
one reviewed combination. Both legacy aliases must use the same private policy
directory/nonce store and an approved service identity. Do not roll back to anonymous
uploads: a safe rollback disables the credential ingress and retains the last
credential, or restores a previously authorized implementation. The detailed
templates and procedures are in each candidate's `docs/credential-control/`.

## Evidence and limits

- [Sakura evidence](evidence/credential-boundary-sakura-20261016.json): 10 handler/
  loopback boundary tests PASS and 3 Surge consumer tests PASS.
- [Taiko evidence](evidence/credential-boundary-taiko-20261016.json): 10 counterpart
  handler/loopback tests PASS.
- Both exact old anonymous probe inputs now produce 401 and zero writer calls.
  Tests also exercise a correctly signed authorized write, owner/audience/scope/
  expiry/revocation/signature rejection, duplicate/concurrent requests and private
  failure responses. Synthetic writers/configurations only.
- The miku handler is extracted into an isolated HTTP fixture; the full Flask app,
  its middleware and actual deployed proxy are not imported or accepted by this test.
  The original AST probe is retained unchanged as old-source evidence, not silently
  rewritten to pass against a different handler signature.

Independent read-only review found no must-fix authorization/replay bypass in this
candidate. Actual UID/config provisioning, active ingress/ACL, installed fixed-wheel
execution and consumer rollout remain unverified. These must close before the
Credential Gate can pass; the local source fixes alone do not authorize deployment.

## Approved installed 0.14.2 follow-up

The earlier source-only limitation is superseded for the new local candidate,
not for the unchanged old environment. Owner-approved wheel from `a632913`
contains the fixes and passed 11 installed actual-handler/operator-CLI tests.
See [local candidate closeout](local-0142-closeout-20261016.md) and
[evidence](evidence/credential-installed-0142-20261016.json). Production ingress,
ACL and caller provisioning remain unverified; Credential Gate is PARTIAL.
