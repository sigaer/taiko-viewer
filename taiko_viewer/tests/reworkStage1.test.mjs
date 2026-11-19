import test from 'node:test';
import assert from 'node:assert/strict';
import {activeDestination,mobileDestinations} from '../utils/rework/navigation.ts';
import {
 catalogState,catalogRequest,catalogQuery,catalogLocation,legacyCatalogLocation,legacyCatalogHref,songSearchRequest,searchAllState,
 shelfSwitch,sortSwitch,keywordSwitch,pageSwitch,defaultSort,pagerItems,pageCount,isLibraryPath,libraryReturnTarget,
 detailFallbackShelf,songDetailLocation,songLevels,formatOpenDay,genreKey,songNames,locationHref
} from '../utils/rework/catalog.ts';
import {searchShortcut,searchSelection} from '../utils/rework/search.ts';

test('desktop groups respect locale and segment boundaries; mobile search is an action',()=>{
 assert.equal(activeDestination('/ja/songs/1?d=5'),'songs');assert.equal(activeDestination('/songsmith'),null);
 assert.equal(activeDestination('/ja/tools/progress'),'play');assert.equal(activeDestination('/my/growth'),'growth');
 assert.equal(activeDestination('/songs?shelf=all'),'songs');assert.equal(activeDestination('/ja/songs/constants'),'songs');
 assert.equal(mobileDestinations.length,5);assert.deepEqual(mobileDestinations[2],{key:'search',action:'search'});
});

test('default sort depends on the shelf; invalid values fall back; the effective sort is returned',()=>{
 assert.equal(defaultSort('available'),'open-day-desc');
 for (const shelf of ['removed','other','all']) assert.equal(defaultSort(shelf),'catalog');
 assert.deepEqual(catalogState({}),{q:'',shelf:'available',sort:'open-day-desc',page:1});
 assert.deepEqual(catalogState({shelf:'removed'}),{q:'',shelf:'removed',sort:'catalog',page:1});
 assert.deepEqual(catalogState({shelf:'all',sort:'open-day-desc'}).sort,'open-day-desc');
 assert.deepEqual(catalogState({shelf:'available',sort:'catalog'}).sort,'catalog');
 assert.deepEqual(catalogState({shelf:'bogus',sort:'title',page:'-3'}),{q:'',shelf:'available',sort:'open-day-desc',page:1});
 assert.equal(catalogState({shelf:'other',sort:'nope'}).sort,'catalog');
 for (const page of ['0','1.5','abc','Infinity','1e3','99999999999999999999','']) assert.equal(catalogState({page}).page,1,page);
 assert.equal(catalogState({page:' 7 '}).page,7);assert.equal(catalogState({page:['3','9']}).page,3);
 assert.equal(catalogState({q:['first','second'],page:'Infinity',shelf:'invalid'}).page,1);
 assert.equal(catalogState({q:'  桜  '}).q,'桜');
});

test('canonical writer omits defaults, fixes key order and writes only the four keys',()=>{
 assert.deepEqual(catalogQuery({}),{});
 assert.deepEqual(catalogQuery({shelf:'available',sort:'open-day-desc',page:1,q:'  '}),{});
 assert.deepEqual(catalogQuery({shelf:'removed',sort:'catalog'}),{shelf:'removed'});
 assert.deepEqual(catalogQuery({shelf:'removed',sort:'open-day-desc'}),{shelf:'removed',sort:'open-day-desc'});
 assert.deepEqual(catalogQuery({shelf:'available',sort:'catalog'}),{sort:'catalog'});
 const written=catalogQuery({page:3,sort:'open-day-desc',shelf:'all',q:'x',list:'removed',extra:'1'});
 assert.deepEqual(Object.keys(written),['q','shelf','sort','page']);
 assert.deepEqual(written,{q:'x',shelf:'all',sort:'open-day-desc',page:'3'});
 assert.deepEqual(catalogLocation({shelf:'other',page:2}),{path:'/songs',query:{shelf:'other',page:'2'}});
 assert.equal(catalogLocation({shelf:'other'},loc=>'/ja'+locationHref(loc)),'/ja/songs?shelf=other');
});

test('parse/write round trips are stable for every shelf, sort and page',()=>{
 for (const shelf of ['available','removed','other','all']) for (const sort of ['open-day-desc','catalog']) for (const page of [1,2,40]) for (const q of ['','千本桜','a b']) {
  const state={q,shelf,sort,page};
  const query=catalogQuery(state);
  assert.deepEqual(catalogState(query),state);
  assert.deepEqual(catalogQuery(catalogState(query)),query);
  const url=new URL('http://x'+locationHref({path:'/songs',query}));
  assert.deepEqual(catalogState(Object.fromEntries(url.searchParams)),state);
 }
});

test('shelf switch keeps the effective sort and keyword and resets page; sort and keyword reset page',()=>{
 const onAvailable=catalogState({q:'桜',page:'4'});
 assert.deepEqual(catalogQuery(shelfSwitch(onAvailable,'removed')),{q:'桜',shelf:'removed',sort:'open-day-desc'});
 const onRemoved=catalogState({shelf:'removed',page:'2'});
 assert.deepEqual(catalogQuery(shelfSwitch(onRemoved,'all')),{shelf:'all'});
 assert.deepEqual(catalogQuery(shelfSwitch(onRemoved,'available')),{sort:'catalog'});
 assert.deepEqual(catalogQuery(shelfSwitch(catalogState({shelf:'all',sort:'open-day-desc'}),'available')),{});
 assert.deepEqual(catalogQuery(sortSwitch(catalogState({shelf:'other',page:'3'}),'open-day-desc')),{shelf:'other',sort:'open-day-desc'});
 assert.deepEqual(catalogQuery(keywordSwitch(catalogState({shelf:'all',page:'5'}),' 新 ')),{q:'新',shelf:'all'});
 assert.deepEqual(catalogQuery(pageSwitch(catalogState({shelf:'removed'}),2)),{shelf:'removed',page:'2'});
});

test('requests use the effective sort, page size 24 and the real shelf statuses',()=>{
 assert.deepEqual(catalogRequest({}),{view:'list',page:1,pageSize:24,keyword:undefined,sort:'open-day-desc',shelfStatus:0});
 assert.deepEqual(catalogRequest({shelf:'removed',q:'x',page:'2'}),{view:'list',page:2,pageSize:24,keyword:'x',sort:'catalog',shelfStatus:1});
 assert.equal(catalogRequest({shelf:'other'}).shelfStatus,2);
 assert.equal('shelfStatus' in catalogRequest({shelf:'all'}),false);
 assert.equal(catalogRequest({},1000).pageSize,60);
 assert.deepEqual(songSearchRequest(' 桜 '),{view:'list',page:1,pageSize:8,keyword:'桜',sort:'catalog'});
});

test('the search panel all-results location matches the panel order',()=>{
 assert.deepEqual(catalogLocation(searchAllState('千本桜')),{path:'/songs',query:{q:'千本桜',shelf:'all'}});
 const library=catalogRequest(catalogLocation(searchAllState('千本桜')).query);
 const panel=songSearchRequest('千本桜');
 assert.deepEqual({...library,pageSize:0},{...panel,pageSize:0});
});

test('legacy list addresses map in zh and ja, with trailing slashes, keeping every query',()=>{
 for (const prefix of ['','/ja']) for (const slash of ['','/','//']) {
  for (const shelf of ['available','removed','other']) {
   assert.deepEqual(legacyCatalogLocation(`${prefix}/songs/${shelf}${slash}`,{q:'千本桜',list:'favorites',page:'2',shelf:'all'}),{path:`${prefix}/songs`,query:{shelf,q:'千本桜',list:'favorites',page:'2'}});
  }
  assert.deepEqual(legacyCatalogLocation(`${prefix}/songs/v2-constants${slash}`,{q:'test',difficulty:['4','5']}),{path:`${prefix}/songs/constants`,query:{q:'test',difficulty:['4','5']}});
 }
 assert.equal(legacyCatalogHref('/songs/available',{}),'/songs?shelf=available');
 assert.equal(legacyCatalogHref('/ja/songs/removed/',{q:'千本 桜',x:['1','2'],flag:null}),'/ja/songs?shelf=removed&q=%E5%8D%83%E6%9C%AC+%E6%A1%9C&x=1&x=2&flag=');
 assert.equal(legacyCatalogHref('/songs/v2-constants',{}),'/songs/constants');
 // available keeps newest-first without a sort parameter
 assert.equal(catalogState(legacyCatalogLocation('/songs/available',{}).query).sort,'open-day-desc');
});

test('numeric ids, /songs/constants and other paths are never treated as legacy',()=>{
 for (const path of ['/songs/1','/ja/songs/1384','/songs/1/','/songs/constants','/ja/songs/constants','/songs','/ja/songs','/songs/available-x','/songsx/available','/songs/AVAILABLE','/ja/songs/1?list=removed','/forum/available']) {
  assert.equal(legacyCatalogLocation(path,{list:'removed',difficulty:'5'}),null,path);
  assert.equal(legacyCatalogHref(path,{}),null,path);
 }
});

test('pager windowing shows first, last and neighbours; single gaps are filled',()=>{
 assert.deepEqual(pagerItems(1,0),[]);assert.deepEqual(pagerItems(1,1),[1]);
 assert.deepEqual(pagerItems(1,5),[1,2,'gap',5]);
 assert.deepEqual(pagerItems(3,5),[1,2,3,4,5]);
 assert.deepEqual(pagerItems(5,10),[1,'gap',4,5,6,'gap',10]);
 assert.deepEqual(pagerItems(10,10),[1,'gap',9,10]);
 assert.deepEqual(pagerItems(4,10),[1,2,3,4,5,'gap',10]);
 assert.deepEqual(pagerItems(99,10),[1,'gap',9,10]);
 assert.ok(pagerItems(50,100).length<=7);
 assert.equal(pageCount(0,24),0);assert.equal(pageCount(24,24),1);assert.equal(pageCount(25,24),2);
});

test('detail links and the way back to the library',()=>{
 assert.deepEqual(songDetailLocation(7,'removed'),{path:'/songs/7',query:{list:'removed'}});
 assert.deepEqual(songDetailLocation(7,'other'),{path:'/songs/7',query:{list:'other'}});
 assert.deepEqual(songDetailLocation(7,'all'),{path:'/songs/7',query:{}});
 assert.deepEqual(songDetailLocation(7,'available'),{path:'/songs/7',query:{}});
 assert.equal(detailFallbackShelf('removed',0),'removed');assert.equal(detailFallbackShelf(undefined,'2'),'other');
 assert.equal(detailFallbackShelf('available',1),'available');assert.equal(detailFallbackShelf(undefined,undefined),'available');
 assert.equal(locationHref(catalogLocation({shelf:detailFallbackShelf(undefined,1)})),'/songs?shelf=removed');
 assert.equal(locationHref(catalogLocation({shelf:detailFallbackShelf(undefined,0)})),'/songs');
 assert.equal(libraryReturnTarget('/songs?shelf=all&q=x&page=2&utm=1','zh'),'/songs?q=x&shelf=all&page=2');
 assert.equal(libraryReturnTarget('/ja/songs?shelf=removed','ja'),'/ja/songs?shelf=removed');
 assert.equal(libraryReturnTarget('/ja/songs/?sort=catalog','ja'),'/ja/songs?sort=catalog');
 for (const [value,locale] of [['/ja/songs','zh'],['/songs','ja'],['/songs/1','zh'],['//evil.example/songs','zh'],['https://evil.example/songs','zh'],['/songs/constants','zh'],[null,'zh'],[42,'zh'],['songs','zh']]) assert.equal(libraryReturnTarget(value,locale),null,String(value));
 assert.ok(isLibraryPath('/ja/songs/'));assert.ok(!isLibraryPath('/songs/1'));
});

test('row fields come from the real list item only',()=>{
 assert.deepEqual(songLevels({level_1:'3',level_2:null,level_3:'-',level_4:10,level_5:''}),[{difficulty:1,star:'3'},{difficulty:4,star:'10'}]);
 assert.equal(formatOpenDay('3/7/2024'),'2024-03-07');assert.equal(formatOpenDay(undefined),null);assert.equal(formatOpenDay('2024-03-07'),null);
 assert.equal(genreKey('游戏音乐'),'game');assert.equal(genreKey('未知'),null);
 assert.deepEqual(songNames({song_name:'千本樱',song_name_jp:'千本桜'},'zh'),{title:'千本樱',titleLang:'zh-CN',subtitle:'千本桜',subtitleLang:'ja'});
 assert.deepEqual(songNames({song_name:'千本樱',song_name_jp:'千本桜'},'ja'),{title:'千本桜',titleLang:'ja',subtitle:'千本樱',subtitleLang:'zh-CN'});
 assert.deepEqual(songNames({song_name:'Only'},'ja'),{title:'Only',titleLang:'zh-CN',subtitle:'',subtitleLang:'zh-CN'});
});

test('search shortcuts protect composition and typing; selection handles empty and shrinking results',()=>{
 assert.equal(searchShortcut({key:'/',isComposing:true},false),null);assert.equal(searchShortcut({key:'/'},true),null);
 assert.equal(searchShortcut({key:'k',metaKey:true},true),'toggle');
 assert.equal(searchSelection('ArrowDown',-1,0),-1);assert.equal(searchSelection('ArrowUp',0,8),7);
 assert.equal(searchSelection('ArrowDown',7,8),0);assert.equal(searchSelection('End',0,8),7);
 assert.equal(searchSelection('unknown',7,2),1);
});

test('the all-results option is reachable as the last option with the same keyboard model',()=>{
 // 8 songs + 2 page actions + 1 all-results option
 const count=11,last=count-1;
 assert.equal(searchSelection('End',-1,count),last);
 assert.equal(searchSelection('ArrowUp',0,count),last);
 assert.equal(searchSelection('ArrowDown',last-1,count),last);
 assert.equal(searchSelection('ArrowDown',last,count),0);
 assert.equal(searchSelection('Home',last,count),0);
 // the option disappears when results shrink: selection is clamped
 assert.equal(searchSelection('unknown',last,count-1),count-2);
});
