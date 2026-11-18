import test from 'node:test';
import assert from 'node:assert/strict';
import {activeDestination,mobileDestinations} from '../utils/rework/navigation.ts';
import {catalogState,catalogRequest,legacyCatalogLocation,songSearchRequest} from '../utils/rework/catalog.ts';
import {searchShortcut,searchSelection} from '../utils/rework/search.ts';
test('desktop groups respect locale and segment boundaries; mobile search is an action',()=>{
 assert.equal(activeDestination('/ja/songs/1?d=5'),'songs');assert.equal(activeDestination('/songsmith'),null);
 assert.equal(activeDestination('/ja/tools/progress'),'play');assert.equal(activeDestination('/my/growth'),'growth');
 assert.equal(mobileDestinations.length,5);assert.deepEqual(mobileDestinations[2],{key:'search',action:'search'});
});
test('catalog legacy links preserve locale and unrelated query state',()=>{
 assert.deepEqual(legacyCatalogLocation('/ja/songs/removed',{q:'千本桜',list:'favorites',page:'2'}),{path:'/ja/songs',query:{q:'千本桜',list:'favorites',page:'2',shelf:'removed'}});
 assert.deepEqual(legacyCatalogLocation('/songs/v2-constants',{q:'test'}),{path:'/songs/constants',query:{q:'test'}});
 assert.equal(legacyCatalogLocation('/songs/1',{difficulty:'5'}),null);
});
test('search and catalog reuse bounded real API fields without alias or paging inventions',()=>{
 assert.deepEqual(songSearchRequest(' 桜 '),{view:'list',page:1,pageSize:8,keyword:'桜',sort:'catalog'});
 assert.equal(catalogRequest({shelf:'removed'}).shelfStatus,1);
 assert.equal(catalogRequest({shelf:'other'}).shelfStatus,2);
 assert.equal(catalogState({q:['first','second'],page:'Infinity',shelf:'invalid'}).page,1);
 assert.equal(catalogRequest({},1000).pageSize,60);
});
test('search shortcuts protect composition and typing; selection handles empty and shrinking results',()=>{
 assert.equal(searchShortcut({key:'/',isComposing:true},false),null);assert.equal(searchShortcut({key:'/'},true),null);
 assert.equal(searchShortcut({key:'k',metaKey:true},true),'toggle');
 assert.equal(searchSelection('ArrowDown',-1,0),-1);assert.equal(searchSelection('ArrowUp',0,8),7);
 assert.equal(searchSelection('ArrowDown',7,8),0);assert.equal(searchSelection('End',0,8),7);
 assert.equal(searchSelection('unknown',7,2),1);
});
