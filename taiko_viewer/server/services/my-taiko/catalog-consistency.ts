import {createHash} from 'node:crypto';
import {createError} from 'h3';

// Compare the captured Authority song projection before Contract serialization
// adds aliases and alias-backed display names.
export function assertSongCatalogSource(rows: unknown, source: {songRowsHash: string}) {
  const digest = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  if (digest !== source.songRowsHash) throw createError({statusCode: 409, statusMessage: 'catalog-source-mismatch'});
}
