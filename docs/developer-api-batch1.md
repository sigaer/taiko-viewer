# Developer API — Batch 1

Batch one focuses on concrete, reusable data—not filter-menu metadata.

## Endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/v1/taiko/catalog/songs` | Public; any supplied Bearer token is validated | Song metadata, original `song_name` / `song_name_jp` fields, and aliases in one response |
| GET | `/api/developer/userdata/{userid}/rating` | Same authorization as the existing Developer userdata endpoint | One Rating response: overall Rating, six dimensions, sample count, algorithm metadata and top-30 song-level details |
| GET | `/api/developer/userdata/{userid}/recommendations` | Same authorization as the existing Developer userdata endpoint | Structured rating-based recommendations |

There is no separate aliases endpoint, no separate B30 endpoint, and no `progress-options` endpoint. The Rating response includes its top-30 detail so consumers do not need two calls. The shared Contract is now v1.1. This is an intentional breaking shape change: `Song.title` is removed rather than maintained alongside duplicate fields. The original v1.0 shape is not supported by this candidate; the current OpenAPI is updated to v1.1.

## Song catalog fields

The songs endpoint returns one canonical song shape:

- `song_name`: the original Chinese/display name from the source catalog.
- `song_name_jp`: the original Japanese name from the catalog, falling back to alias metadata when absent.
- `aliases`: alias strings joined by numeric song ID; empty array when no aliases exist.
- `title` is not returned. Consumers use `song_name` directly; there is no duplicate alias for the same value.
- `catalogRevision` / response `versions.catalogRevision`: SHA-256 over the source song-data and alias-file SHA-256 values. Changing either input changes the catalog revision and ETag.

A missing `song_name` or `song_name_jp` remains `null`; this API does not fabricate translations.

## Authorization and consistency

- The two player-analysis routes reuse the existing `/api/developer/userdata/{userid}` access model, including approved Developer Token service grants and existing cross-user current-score read capability. They do not introduce a ResourceGrant requirement or a new scope.
- Owner-session access follows the same existing source authorization rules.
- The current score payload is captured through the authorized source reader; analysis runs against those captured records. A second authorized read must match the original score snapshot before the response is returned; otherwise the request fails closed.
- Analysis runs through the installed Taiko Python runtime and existing Rating/recommendation algorithms. No new score writer or alternate formula is introduced.
- Rating returns overall Rating, dimension values, sample count, algorithm/aggregation metadata and up to 30 top-rated chart details in one response.
- Recommendations are a separate result because they answer a different question: what to play next, rather than how the player rates now.
- Responses use private/no-store handling. No query options, history, Growth, Goal, annual-report data, writes, sync or upstream credentials are added.

## Explicit limits

- The Contract 1.1 `Song` schema has no `title` field; `song_name`, `song_name_jp` and `aliases` are canonical and required (name values may be null if the source lacks them).
- History, Growth, Goal and annual-report APIs remain future work.
- This branch is still a code candidate. Static tests do not replace build, real isolated SQL/HTTP integration tests, or deployment validation.
