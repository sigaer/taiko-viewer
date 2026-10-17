# Developer API — Batch 1

Batch one focuses on concrete, reusable data—not filter-menu metadata.

## Endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/v1/taiko/catalog/aliases` | Public; any supplied Bearer token is validated | Song IDs, aliases and Japanese titles |
| GET | `/api/developer/userdata/{userid}/rating` | Same authorization as the existing Developer userdata endpoint | One Rating response: overall Rating, six dimensions, sample count, algorithm metadata and top-30 song-level details |
| GET | `/api/developer/userdata/{userid}/recommendations` | Same authorization as the existing Developer userdata endpoint | Structured rating-based recommendations |

There is no separate B30 endpoint and no `progress-options` endpoint. The Rating response includes its top-30 detail so consumers do not need two calls. The frozen v1 Contract/OpenAPI documents are unchanged; additive proposal details live in `developer-api-batch1-openapi.yaml`.

## Authorization and consistency

- The two player-analysis routes reuse the existing `/api/developer/userdata/{userid}` access model, including approved Developer Token service grants and existing cross-user score-read capability. They do not introduce a ResourceGrant requirement or a new scope.
- Owner-session access follows the same existing source authorization rules.
- The current score payload is captured through the authorized source reader; analysis runs against those captured records. A second authorized read must match the original score snapshot before the response is returned; otherwise the request fails closed.
- Analysis runs through the installed Taiko Python runtime and existing Rating/recommendation algorithms. No new score writer or alternate formula is introduced.
- Rating returns overall Rating, dimension values, sample count, algorithm/aggregation metadata and up to 30 top-rated chart details in one response.
- Recommendations are a separate result because they answer a different question: what to play next, rather than how the player rates now.
- Responses use private/no-store handling. No query options, history, Growth, Goal, annual-report data, writes, sync or upstream credentials are added.

## Explicit limits

- The public aliases endpoint is catalog metadata, not player data.
- The top-30 array is structured data, not an image.
- History, Growth, Goal and annual-report APIs remain future work.
- This branch is still a code candidate. Static tests do not replace build, real isolated SQL/HTTP integration tests, or deployment validation.
