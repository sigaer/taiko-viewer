import { defineNuxtConfig } from "nuxt/config";
import packageJson from "./package.json" with { type: "json" };
import { CANONICAL_BASE_URL, SITE_TITLE } from "./utils/seo";

const appVersion = process.env.npm_package_version || packageJson.version;
const themeColor = "#ffb37c";
const backgroundColor = "#f4efe7";
const pwaDescription = "Taiko data viewer, song list, guides, forum and tools.";
const baiduSiteVerification =
  process.env.NUXT_PUBLIC_BAIDU_SITE_VERIFICATION || "codeva-IokhumYAJv";

export default defineNuxtConfig({
  ssr: true,
  components: true,
  i18n: {
    strategy: "prefix_except_default",
    defaultLocale: "zh",
    lazy: true,
    langDir: "locales",
    locales: [
      { code: "zh", language: "zh-CN", file: "zh.ts", name: "简体中文" },
      { code: "ja", language: "ja-JP", file: "ja.ts", name: "日本語" }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "viewer_locale",
      redirectOn: "root",
      alwaysRedirect: false
    },
    bundle: {
      optimizeTranslationDirective: false
    },
    baseUrl: CANONICAL_BASE_URL,
    vueI18n: "./i18n.config.ts"
  },
  app: {
    head: {
      title: SITE_TITLE,
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "application-name", content: SITE_TITLE },
        { name: "description", content: pwaDescription },
        {
          name: "keywords",
          content: "Sakura Taiko Viewer, taiko viewer, taiko data viewer, songs, guides, forum"
        },
        ...(baiduSiteVerification
          ? [{ name: "baidu-site-verification", content: baiduSiteVerification }]
          : []),
        { name: "theme-color", content: themeColor },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: SITE_TITLE }
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "icon", type: "image/png", href: "/icon.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }
      ]
    }
  },
  css: ["~/assets/css/main.css"],
  modules: ["@nuxtjs/i18n", "@element-plus/nuxt", "@vite-pwa/nuxt"],
  pwa: {
    registerType: "autoUpdate",
    manifestFilename: "manifest.webmanifest",
    includeAssets: [
      "icon.png",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "apple-touch-icon.png",
      "pwa-192x192.png",
      "pwa-512x512.png",
      "pwa-192x192-maskable.png",
      "pwa-512x512-maskable.png"
    ],
    manifest: {
      id: "/",
      name: SITE_TITLE,
      short_name: "Taiko Viewer",
      description: pwaDescription,
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: themeColor,
      background_color: backgroundColor,
      lang: "en",
      icons: [
        {
          src: "/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/pwa-192x192-maskable.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: "/pwa-512x512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    },
    workbox: {
      cleanupOutdatedCaches: true,
      manifestTransforms: [],
      globIgnores: ["**/*_payload.json", "**/*.html"],
      navigateFallbackDenylist: [/./]
    },
    devOptions: {
      enabled: false
    }
  },
  runtimeConfig: {
    dataDir: process.env.TAIKO_FRONTEND_DATA_DIR || "",
    repoRoot: process.env.TAIKO_REPO_ROOT || "",
    userdataDir: process.env.TAIKO_USERDATA_DIR || "",
    songDataPath: process.env.TAIKO_SONG_DATA_PATH || "",
    ratingStructPath: process.env.TAIKO_RATING_STRUCT_PATH || "",
    taikoConfigPath: process.env.TAIKO_CONFIG_PATH || "",
    accountCacheDir: process.env.TAIKO_ACCOUNT_CACHE_DIR || "",
    syncTargetsJson: process.env.TAIKO_SYNC_TARGETS_JSON || "",
    localSyncReceiverBaseUrl: process.env.TAIKO_LOCAL_SYNC_RECEIVER_BASE_URL || "",
    dbHost: process.env.TAIKO_DB_HOST || "",
    dbPort: process.env.TAIKO_DB_PORT || "",
    dbUser: process.env.TAIKO_DB_USER || "",
    dbPassword: process.env.TAIKO_DB_PASSWORD || "",
    dbName: process.env.TAIKO_DB_NAME || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: process.env.SMTP_PORT || "",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "",
    developerReviewInbox: process.env.TAIKO_DEVELOPER_REVIEW_INBOX || "",
    wahlapCookie: process.env.TAIKO_WAHLAP_COOKIE || "",
    ossEndpoint: process.env.OSS_ENDPOINT || "",
    ossRegion: process.env.OSS_REGION || "",
    ossBucket: process.env.OSS_BUCKET || "",
    ossAccessKeyId: process.env.OSS_ACCESS_KEY_ID || "",
    ossAccessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "",
    ossPublicBaseUrl: process.env.OSS_PUBLIC_BASE_URL || "",
    ossAvatarPrefix: process.env.OSS_AVATAR_PREFIX || "",
    bilibiliSessData: process.env.BILIBILI_SESSDATA || "",
    bilibiliSessDataFile: process.env.BILIBILI_SESSDATA_FILE || "/home/sigaer/bilisess.txt",
    bilibiliLoginMid: process.env.BILIBILI_LOGIN_MID || "",
    bilibiliCookie: process.env.BILIBILI_COOKIE || "",
    bilibiliHttpProxy: process.env.BILIBILI_HTTP_PROXY || "http://127.0.0.1:18888",
    public: {
      appVersion,
      apiBase: "https://static.sakura-bot.cn",
      guideApiBase: "https://viewer.sakura-bot.cn/taiko-api/guide",
      baiduSiteVerification
    }
  },
  nitro: {
    routeRules: {
      "/": { prerender: false },
      "/ja": { prerender: false },
      "/ja/**": { prerender: false },
      "/guide": { prerender: false },
      "/guide/**": { prerender: false },
      "/songs/**": { prerender: false },
      "/forum/**": { prerender: false },
      "/account/**": { prerender: false },
      "/grade/2025": { prerender: false, redirect: "/grade/2025/%E4%BA%94%E7%B4%9A" },
      "/grade/2025/**": { prerender: false },
      "/titles": { prerender: false },
      "/sitemap.xml": { prerender: false },
      "/robots.txt": { prerender: false },
      "/api/data/**": { prerender: false },
      "/api/content/**": { prerender: false },
      "/api/account/**": { prerender: false },
      "/api/developer/**": { prerender: false },
      "/api/forum/**": { prerender: false },
      "/api/bilibili/**": { prerender: false }
    },
    prerender: {
      crawlLinks: false,
      routes: ["/grade", "/grade/2023", "/grade/2024", "/settings", "/about", "/ja", "/ja/settings", "/ja/about"]
    }
  },
  elementPlus: {
    importStyle: "css"
  }
});
