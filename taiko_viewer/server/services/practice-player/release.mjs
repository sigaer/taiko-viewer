export const DEFAULT_PLAYER_DIR = '/var/lib/taiko/practice-player';
export const MAX_RELEASE_BYTES = 128 * 1024;
export const MAX_PLAYER_FILE_BYTES = 256 * 1024 * 1024;
export const MAX_PLAYER_BYTES = 512 * 1024 * 1024;
const required = ['Build/Web.loader.js', 'Build/Web.data.unityweb', 'Build/Web.framework.js.unityweb', 'Build/Web.wasm.unityweb', 'index.html'];

export function validPlayerFile(name) {
  return typeof name === 'string' && name.length <= 240 &&
    /^(?:index\.html|(?:Build|StreamingAssets)\/[A-Za-z0-9_./-]+)$/.test(name) &&
    name.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
}

export function validatePlayerRelease(value) {
  const match = typeof value?.path === 'string' && /^\/player\/([a-f0-9]{16})\/index\.html$/.exec(value.path);
  if (!match || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)) throw new Error('Invalid player release');
  const entries = Object.entries(value.files);
  if (entries.length > 512 || required.some(name => !Object.hasOwn(value.files, name))) throw new Error('Incomplete player release');
  for (const [name, hash] of entries) {
    if (!validPlayerFile(name) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid player file');
  }
  return { version: match[1], path: value.path, files: Object.fromEntries(entries) };
}
