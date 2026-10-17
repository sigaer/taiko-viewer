# Production admission audit protocol — NOT EXECUTED

Status: **PENDING_AUTHORIZATION**. Viewer 0.82 stays **BLOCKED**. This protocol grants no permission to inspect a live service, configuration, SQL, credentials or quarantined assets. No live commands have been run to prepare it.

## Exact requested scope for later owner authorization

Read-only inspection of the owner-named Viewer and credential ingress services, their corresponding reverse-proxy route blocks, firewall admission rules, service identity, interpreter and installed distribution metadata. The owner must identify the relevant units, configuration files and endpoint names, and authorize this scope explicitly. Do not discover unrelated services or read complete environment/configuration files. SQL access, private userdata, credential files, logs with request bodies, process environments, service restart, live mutation and traffic/load testing are excluded.

The auditor will first present the concrete named paths/units and bounded commands for review. If approved, collect locally and publish only the normalized nonsecret fields below. A secret encountered accidentally must be omitted; neither raw config excerpts nor whole command lines go into Git or chat. Never run `systemctl show ... Environment`, `/proc/*/environ`, whole `.env` reads, full configuration dumps or recursive secret-directory scans.

## Evidence table

| Boundary | Minimum evidence | Decision |
|---|---|---|
| Listener | Authorized unit PID, UID/GID, bind address and port; no process arguments/environment | Unexpected public credential listener = FAIL |
| Reverse proxy | Exact approved hostname/path/method mapping to upstream; allow/deny outcomes from static reviewed rules | Anonymous credential mutation mapping or bypass path = FAIL |
| Network ACL | Only rules relevant to the approved listener/source identities, including IPv4/IPv6 | Unrestricted unintended ingress = FAIL |
| Runtime identity | Authorized unit's executable path/interpreter, nonsecret module invocation, service UID; symlink resolution | Do not infer current deployment from repository HEAD |
| Installed artifacts | Package versions/origins and distribution file hashes using approved interpreter; compare pinned candidate role lock and wheel RECORD | Source checkout/PYTHONPATH fallback or unexpected artifact = FAIL |
| Authentication | Static mapping showing ingress reaches signed service credential control and correct audience; booleans for key/reference presence and permission owner/mode only | No raw keys, tokens, HMAC body or full configuration values |
| Rollback | Owner-confirmed deployed artifact identity and authorized recovery procedure | Until observed, rollback runtime is UNKNOWN; local candidate is not an asserted production rollback |

Approved interpreter queries must use `-I`, metadata only, and a resource-bounded read-only mechanism confirmed compatible with the live host. Never import application startup modules or trigger migrations. A metadata version alone is insufficient proof: hash the allowlisted distribution files and record the evidence verifier version. No local test service or synthetic fixture establishes actual ingress admission.

## Twelve quarantined resources and off-host backup

**BLOCKED_NO_AUTHORIZED_DESTINATION / RIGHTS_CLEARANCE_PENDING**. No authorized remote destination, encryption-key custody, resource allowlist or signed provenance clearance is available in this work order. No private resource was opened, copied, hashed or redistributed. Do not infer rights clearance from technical read permission.

The owner must later supply an approved destination and custodianship policy and authorize a constrained inventory and encrypted backup. Required acceptance evidence: all 12 opaque inventory IDs covered; rights/provenance clearance per ID; encryption and key-recovery custody; durable destination receipt; restore-integrity verification in an authorized private location; checkpoint timestamp/age; last successful attempt; documented retention. Report opaque IDs and sanitized receipts, never filenames revealing private contents or decrypted bytes. Backups must retain SQL/C/H, historical daily/measurement/Goal, Annual published identity/share records, configuration needed for recovery and authorization revocation continuity. Public Taiko packaging remains unchanged.

## Completion and owner disposition

Produce a timestamped, hashed sanitized report with exact PASS/FAIL/BLOCKED per boundary and explicit scope. A reviewer signs the observed admission and rollback identity. Missing permission is PENDING_AUTHORIZATION, not PASS, and must not halt unrelated offline implementation.
