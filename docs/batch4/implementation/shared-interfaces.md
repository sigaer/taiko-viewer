# Phase 0 interface freeze

B4 kernel version `b4-offline/1`; approved source contract `a68d8bda`.
Single public types: `taiko_viewer/utils/multi-objective/contracts.ts`.
Candidate remains `candidate/1`, actionability policy `viewer-multi-objective/1`, slate `viewer-slate/1`.
SlateCard is the implementation name of the contract's RecommendationCard, with identical fields.
No B3 wire type changes. Portfolio input is a read-only projection, not a database schema.

Interfaces frozen before delegation:

- identity.ts: prepare an immutable Authority index; resolveCanonicalChartIdentity(snapshot or prepared index, request) → RESOLVED/UNRESOLVED/AMBIGUOUS. Namespace aliases and actual rows only; no generated chart IDs.
- registries.ts: intent/subtype/target/GoalType/capability lookup, exact target-union validation. No new completion evaluator.
- candidate.ts: validateCandidate(unknown, ValidationContext) → ValidationResult; strict runtime shape plus semantic checks. EvidenceRecord is a versioned resolver envelope for existing EvidenceRef and frozen producer payload, not another Candidate schema.
- actionability.ts: validateActionabilityEvaluation(candidate, context) validates registered outputs and their typed supporting evidence; does not predict scores/crowns or complete Goals.
- goals.ts: associateCandidatesWithPortfolio(candidates, context) returns detached associated copies and diagnostics; no persistence.
- priority.ts / composer.ts: classifyPriorityGroup, validatePrioritySlate, composeRecommendationSlate. Gates explicitly apply to planned slate, never actual browser exposure.

Ownership: Lead contracts/common/evidence/actionability/goals/tests/integration. Agent A identity.ts, B registries.ts, C candidate.ts only after confirming actual tool access. Agent D priority.ts/composer.ts only after A–C integration. No concurrent edits to the same file. If native agents have no tools, they review design only and Lead implements; reports must state this boundary.
