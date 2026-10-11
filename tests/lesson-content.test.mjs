import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeLessonReferences,generateValidatedLesson,teacherLessonTemplate} from '../server/lesson-content.mjs';
import {validateLesson} from '../server/domain.mjs';
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
test('修正仍缺依据时丢弃无效草稿，自动交付经校验的复核记录模板',async()=>{
 let calls=0;const raw=fixture();raw.slides[0].content='不应保存的虚构情节';raw.introduction.knowledge_ids=['t99.p99'];const progress=[];
 const result=await generateValidatedLesson({call:async()=>{calls++;return raw;},goal:'分析',shots,evidence,sources,update:p=>progress.push(p)});
 assert.equal(calls,2);assert.equal(result.mode,'teacher_template');assert.match(result.generation_notice,/未通过依据校验/);assert.match(result.slides[1].content,/已复核人物特写/);assert(!JSON.stringify(result).includes('不应保存的虚构情节'));assert.equal(validateLesson(result,shots,evidence),result);assert(progress.some(p=>p.progress===92));
});
test('模型超时或解析失败时自动整理模板，修正阶段故障也不阻断交付',async()=>{
 for(const attempt of [1,2]){let calls=0;const raw=fixture();raw.board.shot_ids=[];
 const result=await generateValidatedLesson({call:async()=>{calls++;if(calls===attempt)throw Error('network timeout or malformed JSON');return raw;},goal:'分析',shots,evidence,sources});
 assert.equal(calls,attempt);assert.equal(result.mode,'teacher_template');assert.match(result.generation_notice,/模型暂时/);validateLesson(result,shots,evidence);}
});
test('长复核记录整理模板仍符合正文上限，缺少真实依据不能伪造交付',()=>{
 const many=Array.from({length:10},(_,i)=>({...shots[0],id:'s'+i,index:i+1,composition:'构'.repeat(3000),lighting:'光'.repeat(3000),movement:'动'.repeat(3000),function:'析'.repeat(3000)}));
 const result=teacherLessonTemplate({shots:many,evidence,sources});validateLesson(result,many,evidence);
 assert.throws(()=>teacherLessonTemplate({shots:shots.map(s=>({...s,knowledge_ids:[]})),evidence:[],sources:[]}),/缺少有效镜头或知识点引用/);
});
test('引用本来有效时只调用一次模型',async()=>{let calls=0;await generateValidatedLesson({call:async()=>{calls++;return fixture();},goal:'分析',shots,evidence,sources});assert.equal(calls,1);});
