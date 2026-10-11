import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateSegments,validateSelection,mergeTeachingSelection} from '../server/teaching-selection.mjs';
test('大量切镜只提供20个候选，覆盖首尾而非逐镜调用模型',()=>{
 const c=candidateSegments(Array.from({length:45},(_,i)=>i*4));assert.equal(c.length,20);assert.equal(c[0].start,0);assert.equal(c.at(-1).end,176);assert.equal(new Set(c.map(x=>x.id)).size,20);
});
test('AI精选限10项、有教学理由、真实ID、不允许重复或虚构',()=>{
 const c=candidateSegments([0,10,20,30]);const s=validateSelection({selected:[{id:'c3',reason:'叙事转折'},{id:'c1',reason:'建立空间'},{id:'c2',reason:'行动推进'}]},c);assert.equal(s[0].id,'c1');assert.equal(s.length,3);
 for(const selected of [[{id:'fake',reason:'虚构'}],[{id:'c1',reason:''}],[{id:'c1',reason:'有价值'},{id:'c1',reason:'重复'}],Array(11).fill({id:'c1',reason:'超限'})])assert.throws(()=>validateSelection({selected},c));
});
test('无场景切换和仅两段视频仍提供3个真实时间区间，不虚构剪辑边界',()=>{
 for(const cuts of [[0,180],[0,50,180]]){const c=candidateSegments(cuts);assert.equal(c.length,3);assert.equal(c[0].start,0);assert.equal(c.at(-1).end,180);assert(c.some(s=>s.continuous));for(let i=0;i<c.length;i++){assert(c[i].start<c[i].end);if(i)assert.equal(c[i-1].end,c[i].start);}}
 assert.throws(()=>candidateSegments([0,.1]),/过短/);
});
test('模型只选一段时补至3段并保留教师标注，总数不超过10',()=>{
 const c=candidateSegments(Array.from({length:15},(_,i)=>i*10));const selected=validateSelection({selected:[{id:c[0].id,reason:'建立空间'}]},c,10,0);
 assert.throws(()=>validateSelection({selected:[{id:c[0].id,reason:'一段'}]},c),/3至10/);
 const preserved={id:'teacher-shot',start:0,end:10,teaching_reason:'教师保留的说明'};
 const result=mergeTeachingSelection([preserved],selected,c);assert.equal(result.length,3);assert.equal(result[0].teaching_reason,preserved.teaching_reason);assert.equal(new Set(result.map(s=>s.start+'-'+s.end)).size,3);
 assert.equal(mergeTeachingSelection([],c,c).length,10);assert.throws(()=>mergeTeachingSelection(Array(11).fill(preserved),[],c),/超过10/);
});
