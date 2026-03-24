import { defineNuxtConfig } from "nuxt/config";
import packageJson from "./package.json" with { type: "json" };

const appVersion = process.env.npm_package_version || packageJson.version;

export default defineNuxtConfig({
  ssr: true,
  components: true,
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      titleTemplate: (titleChunk) => (titleChunk ? `Taiko · ${titleChunk}` : "Taiko"),
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Taiko 太鼓达人数据看板，提供歌曲列表、谱面攻略、段位查询与主题设置。"
        }
      ]
    }
  },
  css: ["~/assets/css/main.css"],
  modules: ["@element-plus/nuxt"],
  runtimeConfig: {
    dataDir: process.env.TAIKO_FRONTEND_DATA_DIR || "",
    repoRoot: process.env.TAIKO_REPO_ROOT || "",
    userdataDir: process.env.TAIKO_USERDATA_DIR || "",
    songDataPath: process.env.TAIKO_SONG_DATA_PATH || "",
    taikoConfigPath: process.env.TAIKO_CONFIG_PATH || "",
    accountCacheDir: process.env.TAIKO_ACCOUNT_CACHE_DIR || "",
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
    wahlapCookie: process.env.TAIKO_WAHLAP_COOKIE || "",
    ossEndpoint: process.env.OSS_ENDPOINT || "",
    ossRegion: process.env.OSS_REGION || "",
    ossBucket: process.env.OSS_BUCKET || "",
    ossAccessKeyId: process.env.OSS_ACCESS_KEY_ID || "",
    ossAccessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "",
    ossPublicBaseUrl: process.env.OSS_PUBLIC_BASE_URL || "",
    ossAvatarPrefix: process.env.OSS_AVATAR_PREFIX || "",
    public: {
      appVersion,
      apiBase: "https://static.sakura-bot.cn",
      guideApiBase: "https://viewer.sakura-bot.cn/taiko-api/guide"
    }
  },
  nitro: {
    routeRules: {
      "/": { prerender: false },
      "/songs/**": { prerender: false },
      "/forum/**": { prerender: false },
      "/account/**": { prerender: false },
      "/grade/2025": { prerender: false, redirect: "/grade/2025/%E4%BA%94%E7%B4%9A" },
      "/grade/2025/**": { prerender: false },
      "/titles": { prerender: false },
      "/api/data/**": { prerender: false },
      "/api/account/**": { prerender: false },
      "/api/forum/**": { prerender: false }
    },
    prerender: {
      crawlLinks: false,
      routes: [
        "/grade",
        "/grade/2023",
        "/grade/2024",
        "/settings",
        "/about"
      ]
    }
  },
  elementPlus: {
    importStyle: "css"
  }
});
