import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import base from '../../taiko_viewer/nuxt.config';

// This root is an opt-in, local-only preview. Business server routes are not loaded.
const previewRoot = fileURLToPath(new URL('.', import.meta.url));
const sourceRoot = resolve(process.env.SONG_PREVIEW_SOURCE || resolve(previewRoot, '../../taiko_viewer'));
export default defineNuxtConfig({
  ...base,
  rootDir: previewRoot,
  srcDir: sourceRoot,
  serverDir: resolve(previewRoot, 'server'),
  buildDir: resolve(previewRoot, '.nuxt'),
  devServer: { host: '127.0.0.1', port: 3208 },
  devtools: { enabled: false },
  hooks: {
    'pages:extend'(pages) {
      pages.push({name:'local-song-rows-review',path:'/__song-rows',file:resolve(previewRoot,'review/song_rows.vue')});
      pages.push({name:'local-growth-review',path:'/__growth-review',file:resolve(previewRoot,'review/growth.vue')});
      pages.push({name:'local-batch2-review',path:'/__batch2',file:resolve(previewRoot,'review/batch2.vue')});
      pages.push({name:'local-palette-controls',path:'/__palette-controls',file:resolve(previewRoot,'review/palette-controls.vue')});
      pages.push({name:'local-completion-review',path:'/__completion',file:resolve(previewRoot,'review/completion.vue')});
      pages.push({name:'local-design-review',path:'/__review',file:resolve(previewRoot,'review/index.vue')});
    }
  },
  vite: {
    server: { fs: { allow: [sourceRoot, previewRoot, resolve(sourceRoot, '../packages'), realpathSync(resolve(sourceRoot, 'node_modules'))] } }
  },
  i18n: {
    ...base.i18n,
    langDir: resolve(sourceRoot, 'i18n/locales'),
    vueI18n: resolve(sourceRoot, 'i18n.config.ts')
  },
  dir: { public: resolve(sourceRoot, 'public') },
  runtimeConfig: {
    ...base.runtimeConfig,
    dbHost: '127.0.0.1', dbPort: '1', dbUser: 'song_preview', dbPassword: '', dbName: 'song_preview_test',
    public: { ...base.runtimeConfig?.public, googleAnalyticsId: '', webVitalsSampleRate: 0 }
  },
  nitro: {
    ...base.nitro, storage: {}, devStorage: {},
    // Review artifacts are opt-in local preview assets, never production routes.
    publicAssets: [
      ...(process.env.VIEWER_BATCH2_EVIDENCE ? [{ dir: resolve(process.env.VIEWER_BATCH2_EVIDENCE, "screenshots"), baseURL: "/__batch2-shots", maxAge: 0 }] : []),
      { dir: resolve(previewRoot, '../../docs/song-detail-preview-20261020/mobile-integration'), baseURL: '/__song-review', maxAge: 0 },
      { dir: resolve(previewRoot, '../../docs/song-detail-preview-20261020'), baseURL: '/__song-history', maxAge: 0 },
      { dir: resolve(previewRoot, '../../docs/viewer-lightness-20261020'), baseURL: '/__review-assets', maxAge: 0 }
    ]
  }
});
