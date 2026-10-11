import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateSegments,validateSelection} from '../server/teaching-selection.mjs';
test('大量切镜只提供20个候选，覆盖首尾而非逐镜调用模型',()=>{
 const c=candidateSegments(Array.from({length:45},(_,i)=>i*4));assert.equal(c.length,20);assert.equal(c[0].start,0);assert.equal(c.at(-1).end,176);assert.equal(new Set(c.map(x=>x.id)).size,20);
});
test('AI精选限10项、有教学理由、真实ID、不允许重复或虚构',()=>{
 const c=candidateSegments([0,10,20,30]);const s=validateSelection({selected:[{id:'c3',reason:'叙事转折'},{id:'c1',reason:'建立空间'}]},c);assert.equal(s[0].id,'c1');assert.equal(s.length,2);
 for(const selected of [[{id:'fake',reason:'虚构'}],[{id:'c1',reason:''}],[{id:'c1',reason:'有价值'},{id:'c1',reason:'重复'}],Array(11).fill({id:'c1',reason:'超限'})])assert.throws(()=>validateSelection({selected},c));
});
