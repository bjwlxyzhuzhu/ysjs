import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeLessonReferences,generateValidatedLesson} from '../server/lesson-content.mjs';
const shots=[{id:'real-shot-uuid',index:1,knowledge_ids:['t2.p04'],function:'已复核人物特写'}],evidence=['t2.p04'],sources=[{id:'t2.p04',title:'景别'}];
function fixture(){const item={title:'观察',content:'根据已复核人物特写设计课堂观察。',shot_ids:['real-shot-uuid'],knowledge_ids:['t2.p04']};return {slides:Array.from({length:3},()=>({...item})),questions:Array.from({length:5},()=>({...item,level:'分析'})),board:{...item},introduction:{...item}};}
test('唯一序号、单值引用和知识点页码格式兼容，但不伪造缺失依据',()=>{
 const raw=fixture();raw.board.shot_ids='镜头 #1';raw.board.knowledge_ids='T2.p4';const result=normalizeLessonReferences(raw,shots,evidence);assert.deepEqual(result.board.shot_ids,['real-shot-uuid']);assert.deepEqual(result.board.knowledge_ids,['t2.p04']);delete raw.introduction.shot_ids;assert.deepEqual(normalizeLessonReferences(raw,shots,evidence).introduction.shot_ids,[]);
 raw.board.shot_ids='999';assert.deepEqual(normalizeLessonReferences(raw,shots,evidence).board.shot_ids,['999']);
});
test('生成漏引用时仅修正一次，修正后严格验证，更新真实阶段进度',async()=>{
 const raw=fixture();raw.board.shot_ids=[];let calls=0;const progress=[];
 const result=await generateValidatedLesson({call:async messages=>{calls++;if(calls===2){const input=JSON.parse(messages[1].content);assert(input.validation_error.includes('板书'));assert.deepEqual(input.allowed_shot_ids,['real-shot-uuid']);}return calls===1?raw:fixture();},goal:'景别教学',shots,evidence,sources,update:p=>progress.push(p)});
 assert.equal(calls,2);assert.equal(result.slides.length,3);assert(progress.some(p=>p.progress===84));
});
test('不存在的引用不能通过，修正失败不保存成功；网络错误不触发内容修正',async()=>{
 let calls=0;const raw=fixture();raw.introduction.knowledge_ids=['t99.p99'];await assert.rejects(()=>generateValidatedLesson({call:async()=>{calls++;return raw;},goal:'分析',shots,evidence,sources}),/仍未通过依据校验/);assert.equal(calls,2);
 calls=0;await assert.rejects(()=>generateValidatedLesson({call:async()=>{calls++;throw Error('network timeout');},goal:'分析',shots,evidence,sources}),/network timeout/);assert.equal(calls,1);
});
test('引用本来有效时只调用一次模型',async()=>{let calls=0;await generateValidatedLesson({call:async()=>{calls++;return fixture();},goal:'分析',shots,evidence,sources});assert.equal(calls,1);});
