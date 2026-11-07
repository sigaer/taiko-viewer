// Real Vue SFCs, Vue Router, Element Plus and production forum resource logic.
// Nuxt data/SEO ports are controlled; no business backend or production DB.
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';

export async function forumDiscoveryBrowserRuntime(repo, scratch) {
  const source = resolve(repo, 'taiko_viewer'), root = resolve(scratch, 'forum-browser');
  await mkdir(root);
  await symlink(resolve(source, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  await writeFile(resolve(root, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>.qa-content{max-width:1100px;margin:auto;padding:20px;min-width:0}</style></head><body><div id="__nuxt"></div><script type="module" src="/main.js"></script></body></html>');
  await writeFile(resolve(root, 'main.js'), `
import * as Vue from 'vue';
import {createRouter,createWebHistory,RouterLink,RouterView,useRoute,useRouter} from 'vue-router';
import {createI18n,useI18n} from 'vue-i18n';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import '${source}/assets/css/main.css';
import zh from '${source}/locales/zh.json';
import ja from '${source}/locales/ja.json';
import Card from '${source}/components/forum/ForumThreadCard.vue';
import Badge from '${source}/components/forum/ForumUserBadge.vue';
import Cover from '${source}/components/SongCoverImage.vue';
import SafeImage from '${source}/components/forum/ForumSafeImage.vue';
import ReadState from '${source}/components/forum/ReadState.vue';
import List from '${source}/components/forum/ThreadListPage.vue';
import Home from '${source}/pages/forum/index.vue';
import Detail from '${source}/pages/forum/thread/[id].vue';
import Regular from '${repo}/preview/song-detail/review/forum_discovery.vue';
import {useForumResource} from '${source}/composables/useForumResource.ts';
import {useAccountRequestGuard} from '${source}/composables/useAccountRequestGuard.ts';
const {ref,h,computed,Suspense,createApp}=Vue;
const locale=location.pathname.startsWith('/ja/')?'ja':'zh';
const states=new Map();
const useState=(key,factory)=>{if(!states.has(key))states.set(key,ref(factory()));return states.get(key)};
const asyncData=(_key,load,options={})=>{
 const data=ref(options.default?.()??null),pending=ref(false);let sequence=0;
 const refresh=async()=>{const ticket=++sequence;pending.value=true;try{const value=await load();if(ticket===sequence)data.value=value;}finally{if(ticket===sequence)pending.value=false}};
 const clear=()=>{sequence++;data.value=null;pending.value=false};
 void refresh();return {data,pending,refresh,clear};
};
Object.assign(globalThis,Vue,{
 useRoute,useRouter,useI18n,useState,useAsyncData:asyncData,useLazyAsyncData:asyncData,
 useAccountState:()=>({accountUser:useState('account-user',()=>null)}),useAccountRequestGuard,useForumResource,
 definePageMeta:()=>{},useViewerSeo:()=>{},
 useViewerDateTime:()=>({formatDateTime:value=>new Date(value).toLocaleString(locale)}),
 useLocalePath:()=>{const {locale}=useI18n();return value=>{
  const prefix=locale.value==='ja'?'/ja':'';
  return typeof value==='string'?prefix+value:{...value,path:prefix+value.path};
 }},
 useViewerApiFetch:()=>async(path,options={})=>{
  const url=new URL(path,location.origin);
  for(const [key,value] of Object.entries(options.query||{}))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  const response=await fetch(url,{method:options.method||'GET'});
  if(!response.ok)throw Object.assign(new Error('Fixture read failed'),{statusCode:response.status});
  return response.json();
 }
});
const routes=['','/ja'].flatMap(prefix=>[
 {path:prefix+'/__forum-discovery',component:Regular},
 {path:prefix+'/forum/discussions',component:List},
 {path:prefix+'/forum/section/:slug',component:List},
 {path:prefix+'/forum/thread/:id',component:Detail},
 {path:prefix+'/forum',component:Home}
]);
const router=createRouter({history:createWebHistory(),routes});
const app=createApp({setup:()=>()=>h('main',{class:'qa-content'},[h(RouterView,null,{default:({Component})=>h(Suspense,null,{default:()=>Component})})])});
for(const [name,component] of Object.entries({NuxtLink:RouterLink,ForumThreadCard:Card,ForumUserBadge:Badge,SongCoverImage:Cover,ForumSafeImage:SafeImage,ForumReadState:ReadState}))app.component(name,component);
app.use(router);app.use(createI18n({legacy:false,locale,fallbackLocale:'zh',messages:{zh,ja},missingWarn:false,fallbackWarn:false}));app.use(ElementPlus);
app.$nuxt={isHydrating:true,$router:router};
const dark=localStorage.getItem('taiko_theme')==='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.body.classList.toggle('theme-dark',dark);
await router.isReady();app.mount('#__nuxt');app.$nuxt.isHydrating=false;
`);
  const server = await createServer({ configFile: false, root, publicDir: resolve(source, 'public'),
    plugins: [vue(), { name: 'forum-qa-transport', configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.startsWith('/api/')) return next();
        if (request.method !== 'GET') { response.statusCode = 405; response.end(); return; }
        const fixture = await server.ssrLoadModule(resolve(repo, 'preview/song-detail/server/utils/forum-discovery-fixtures.ts'));
        const common = await server.ssrLoadModule(resolve(repo, 'preview/song-detail/server/utils/community-fixtures.ts'));
        const value = url.pathname === '/api/forum/sections' ? { items: common.communitySections }
          : fixture.discoveryData(url.pathname, Object.fromEntries(url.searchParams), 'forum-discovery') ?? { items: [] };
        response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(value));
      });
    }}],
    resolve: { alias: { '~': source, '@': source, vue: resolve(source, 'node_modules/vue/dist/vue.esm-bundler.js') } },
    optimizeDeps: { include: ['vue', 'vue-router', 'vue-i18n', 'element-plus'] },
    server: { host: '127.0.0.1', port: 3208, strictPort: true, fs: { allow: [repo, root] } }
  });
  await server.listen();
  return server;
}
