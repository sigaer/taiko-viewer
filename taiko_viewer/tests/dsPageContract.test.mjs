import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceIdentity,compareContracts} from '../scripts/ds/page-contract.mjs';
test('only the known cover cache key is ignored',()=>{
 assert.equal(resourceIdentity('https://static.sakura-bot.cn/cover/1.png?v=1','https://localhost'),'https://static.sakura-bot.cn/cover/1.png');
 assert.notEqual(resourceIdentity('https://static.sakura-bot.cn/cover/1.png?v=1&variant=a','https://localhost'),resourceIdentity('https://static.sakura-bot.cn/cover/2.png?v=1&variant=a','https://localhost'));
 assert.equal(resourceIdentity('/image.png?v=1','https://localhost'),'/image.png?v=1');
});
test('missing evidence, layout, color, content and asset regressions remain failures',()=>{
 assert.ok(compareContracts(null,null).length);
 assert.ok(compareContracts({schema:1},{schema:1}).length);
 const base={schema:1,records:[{rect:[0,0,44,44],style:{color:'red'},text:'ready'}],document:[390,844],images:[{src:'/1.png',loaded:true}],fonts:['Barlow|400|normal']};
 assert.deepEqual(compareContracts(base,structuredClone(base)),[]);
 for(const change of [x=>x.records[0].rect[2]++,x=>x.records[0].style.color='blue',x=>x.records[0].text='failed',x=>x.images[0].src='/2.png']){const next=structuredClone(base);change(next);assert.ok(compareContracts(base,next).length);}
});
