import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {isFirefoxAndroid,FIREFOX_ANDROID_BOOTSTRAP,firefoxKeyboardViewport} from '../utils/firefox-android.mjs';
import {createFirefoxScrollStore} from '../utils/firefox-scroll-restoration.ts';
import {viewerScrollElement,viewerScrollY,scrollViewerTo} from '../utils/viewer-scroll.ts';
const cases=[
 ['Firefox Android','Mozilla/5.0 (Android 16; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0',true],
 ['Firefox Android tablet','Mozilla/5.0 (Android 15; Tablet; rv:147.0) Gecko/147.0 Firefox/147.0',true],
 ['Chrome Android','Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/144.0 Mobile Safari/537.36',false],
 ['Edge Android','Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/144.0 Mobile Safari/537.36 EdgA/144.0',false],
 ['Firefox iOS','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/147.0 Mobile/15E148 Safari/605.1.15',false],
 ['Safari iOS','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',false],
 ['Firefox desktop','Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',false],
 ['Empty','',false]
];
for(const [name,ua,expected] of cases)test(name+' detection and parser-time bootstrap agree',()=>{
 assert.equal(isFirefoxAndroid(ua),expected);const classes=[];runInNewContext(FIREFOX_ANDROID_BOOTSTRAP,{navigator:{userAgent:ua},document:{documentElement:{classList:{add:c=>classes.push(c)}}}});assert.deepEqual(classes,expected?['firefox-android']:[]);
});
test('SSR can import scroll utilities without any DOM',()=>{assert.equal(viewerScrollElement(),null);assert.equal(viewerScrollY(),0);assert.doesNotThrow(()=>scrollViewerTo({top:20}));});
const keyboard=options=>firefoxKeyboardViewport({innerHeight:844,height:844,baselineHeight:844,editable:true,...options});
test('Toolbar-only resize and focus alone keep navigation visible',()=>{assert.equal(keyboard({height:780}).open,false);assert.equal(keyboard({}).open,false);assert.equal(keyboard({height:400,editable:false}).open,false);});
test('Keyboard detection handles visual-only and layout viewport resizing',()=>{assert.deepEqual(keyboard({height:460,offsetTop:20}),{open:true,inset:364});assert.deepEqual(keyboard({innerHeight:460,height:460}),{open:true,inset:0});assert.equal(keyboard({height:844}).open,false);});
test('Pinch zoom is not a keyboard',()=>{assert.equal(keyboard({height:400,scale:2}).open,false);});
test('History entries for the same URL remain independent and survive refresh',()=>{let raw;const storage={getItem:()=>raw,setItem:(_,s)=>{raw=s;}};const store=createFirefoxScrollStore(storage);store.set('1:/songs',{top:500,left:0});store.set('3:/songs',{top:1200,left:0});store.persist();const next=createFirefoxScrollStore(storage);assert.equal(next.get('1:/songs').top,500);assert.equal(next.get('3:/songs').top,1200);});
test('Scroll persistence is bounded and tolerates corruption/storage denial',()=>{let raw;const store=createFirefoxScrollStore({getItem:()=>'{',setItem:(_,s)=>{raw=s;}});for(let i=0;i<100;i++)store.set(i+':/songs',{top:i,left:0});store.set('bad',{top:Infinity,left:0});store.persist();assert.equal(JSON.parse(raw).length,60);assert.equal(store.get('0:/songs'),undefined);assert.equal(store.get('99:/songs').top,99);assert.doesNotThrow(()=>createFirefoxScrollStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}).persist());});
test('Compatibility stylesheet is UA + phone scoped; existing safe-area rule stays intact',()=>{
 const css=readFileSync(new URL('../assets/css/ds/firefox-android.css',import.meta.url),'utf8');assert.match(css,/@media \(max-width: 767px\)/);for(const selector of css.matchAll(/^  ([^/\n][^\n]*?)\s*\{/gm))assert.ok(selector[1].startsWith('html.firefox-android'),selector[1]);
 const shell=readFileSync(new URL('../components/rework/Shell.vue',import.meta.url),'utf8');assert.match(shell,/calc\(4px \+ env\(safe-area-inset-bottom\)\)/);assert.match(css,/rework-bottom\s*\{\s*position: static;\s*flex: 0 0 auto/);assert.match(css,/rework-main\s*\{[^}]*min-height: 0;[^}]*overflow-y: auto/s);assert.doesNotMatch(css,/translateZ|will-change/);
});
