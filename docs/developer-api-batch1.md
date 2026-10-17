# Developer API — Batch 1

This batch adds three structured analysis reads and one public catalog read to the existing `/api/v1/taiko` surface.

## Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/taiko/catalog/aliases` | Public; optional Developer Bearer is validated if supplied | Song IDs, aliases and Japanese titles |
| GET | `/api/v1/taiko/players/{playerId}/rating` | Existing Developer Token + live `scores:read` ResourceGrant | Overall Rating, sample count and six dimensions |
| GET | `/api/v1/taiko/players/{playerId}/b30` | Existing Developer Token + live `scores:read` ResourceGrant | Structured B30/top-30 results and six-dimensional analysis |
| GET | `/api/v1/taiko/players/{playerId}/recommendations` | Existing Developer Token + live `scores:read` ResourceGrant | Structured rating-based recommendations |

Existing `catalog/songs`, `catalog/charts`, `meta`, `players/{playerId}/profile` and `scores` remain unchanged.

## Behaviour

- Public catalog reads do not require a token. If an Authorization header is present, it must be valid; invalid credentials do not fall back to anonymous access.
- Private endpoints reuse the existing API client, ResourceGrant, quota and committed Publication read path. The grant is rechecked around the computation; the result is private/no-store.
- Analysis runs through the already-installed Taiko Python runtime and its existing algorithms. This batch does not introduce a second rating implementation or any score writer.
- Responses carry the existing contract/schema/catalog revisions and a score revision based on the committed Publication sequence and commit ID.
- No new scopes, migrations, app allowlists or automatic user consent are introduced.

## Explicit limitations

- B30 returns structured score/rating rows and dimension values, not a rendered image.
- Recommendations use the existing rating-based ordinary recommendation model.
- Historical score series, growth/goal analytics, progress completion summaries, and annual-report data are not part of this batch.
- This branch is a code candidate only. Build, runtime integration tests, SDK examples and deployment are not implied by adding these routes.
