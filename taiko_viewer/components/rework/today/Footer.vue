<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const runtimeConfig = useRuntimeConfig();
const appVersion = String(runtimeConfig.public.appVersion || "").trim() || "dev";
const year = new Date().getFullYear();
const exploreLinks = [
  { to: "/songs", key: "nav.songs" },
  { to: "/guide", key: "nav.guide" },
  { to: "/grade", key: "nav.grade" },
  { to: "/titles", key: "nav.titles" },
  { to: "/tools", key: "nav.tools" }
];
const communityLinks = [
  { to: "/forum", key: "nav.communityHome" },
  { to: "/support", key: "home.footer.feedback" },
  { to: "/about", key: "nav.about" }
];
</script>

<template>
  <footer class="home-footer" :aria-label="t('home.footer.label')">
    <section class="home-footer__friends" aria-labelledby="home-friends-title">
      <h2 id="home-friends-title">{{ t("home.footer.friends") }}</h2>
      <a class="home-footer__friend" href="https://net.ourtaiko.org/" target="_blank" rel="noopener noreferrer">
        <span class="home-footer__friend-name">OurTaikoNET<small>NET.OURTAIKO.ORG</small></span>
        <ReworkIcon name="open" />
      </a>
    </section>

    <div class="home-footer__thanks">
      <span>{{ t("home.footer.thanks") }}</span>
      <span>Special Thanks: <strong>Sparkbarry</strong></span>
    </div>

    <div class="home-footer__card">
      <div class="home-footer__main">
        <div class="home-footer__brand">
          <p class="home-footer__name">Sakura Taiko Viewer</p>
          <span class="home-footer__version num">v{{ appVersion }}</span>
          <p class="home-footer__description">{{ t("home.footer.description") }}</p>
        </div>
        <nav class="home-footer__nav" :aria-label="t('home.footer.explore')">
          <h2>{{ t("home.footer.explore") }}</h2>
          <NuxtLink v-for="link in exploreLinks" :key="link.to" :to="localePath(link.to)">{{ t(link.key) }}</NuxtLink>
        </nav>
        <nav class="home-footer__nav" :aria-label="t('home.footer.community')">
          <h2>{{ t("home.footer.community") }}</h2>
          <NuxtLink v-for="link in communityLinks" :key="link.to" :to="localePath(link.to)">{{ t(link.key) }}</NuxtLink>
        </nav>
      </div>
      <div class="home-footer__legal">
        <div>
          <p>{{ t("home.footer.copyright", { year }) }}</p>
          <p>{{ t("home.footer.project") }}</p>
        </div>
        <p class="home-footer__disclaimer">{{ t("home.footer.disclaimer") }}</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.home-footer {
  display: grid;
  gap: var(--sp-6);
  min-width: 0;
  margin-top: var(--sp-8);
  color: var(--ink);
  font-family: var(--font-ui);
}
.home-footer h2 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 700;
}
.home-footer__friends {
  display: grid;
  gap: var(--sp-3);
}
.home-footer__friend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  width: min(100%, 340px);
  min-height: var(--hit);
  padding: var(--sp-4) var(--sp-5);
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.home-footer__friend-name {
  display: grid;
  gap: var(--sp-1);
  font-size: var(--fs-16);
  font-weight: 700;
}
.home-footer__friend small {
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 500;
  letter-spacing: 0.06em;
}
.home-footer__friend svg {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--ink-2);
}
.home-footer__friend:hover {
  border-color: var(--link);
  background: var(--bg-sunk);
}
.home-footer a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.home-footer__thanks {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-5);
  padding-top: var(--sp-5);
  border-top: 1px solid var(--line);
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.home-footer__thanks strong { margin-left: var(--sp-2); color: var(--ink); }
.home-footer__card {
  min-width: 0;
  padding: var(--sp-8);
  border: 1px solid var(--line);
  border-radius: var(--sp-6);
  background: var(--surface);
}
.home-footer__main {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) repeat(2, minmax(0, 1fr));
  gap: var(--sp-8);
}
.home-footer__name {
  margin: 0 0 var(--sp-2);
  color: var(--brand-mark);
  font-size: var(--fs-22);
  font-weight: 800;
  line-height: var(--lh-snug);
}
.home-footer__version {
  display: inline-block;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.home-footer__description {
  max-width: 26em;
  margin: var(--sp-4) 0 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.home-footer__nav { display: grid; align-content: start; }
.home-footer__nav h2 { margin-bottom: var(--sp-2); }
.home-footer__nav a {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  min-width: var(--hit);
  width: fit-content;
  max-width: 100%;
  border-radius: var(--r-xs);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
}
.home-footer__nav a:hover { color: var(--link); text-decoration: underline; text-underline-offset: 3px; }
.home-footer__legal {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--sp-4) var(--sp-8);
  margin-top: var(--sp-8);
  padding-top: var(--sp-5);
  border-top: 1px solid var(--line);
  color: var(--ink-2);
  font-size: var(--fs-12);
  line-height: var(--lh-body);
}
.home-footer__legal p { margin: 0; }
.home-footer__disclaimer { max-width: 34em; }
@media (max-width: 767px) {
  .home-footer { margin-top: var(--sp-5); }
  .home-footer__card { padding: var(--sp-5); }
  .home-footer__main { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-4); }
  .home-footer__brand { grid-column: 1 / -1; }
  .home-footer__legal { margin-top: var(--sp-6); }
}
</style>
