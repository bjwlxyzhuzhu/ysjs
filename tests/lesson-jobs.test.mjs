import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLessonJobs} from '../server/lesson-jobs.mjs';
function store(generate){const records=new Map();const manager=createLessonJobs({list:(type,owner)=>[...records.values()].filter(x=>x.type===type&&x.owner===owner).map(x=>x.value),save:(type,j,owner)=>records.set(j.id,{type,owner,value:structuredClone(j)}),get:(id,owner)=>{const r=records.get(id);if(!r||r.owner!==owner)throw Error('未找到记录');return structuredClone(r.value);},generate});return {manager,records};}
test('重复点击共用进行中的生成任务，成功可查回材料',async()=>{
 let release,calls=0;const {manager,records}=store(async()=>{calls++;await new Promise(r=>release=r);const lesson={id:'l1',content:{}};records.set('l1',{owner:'teacher',type:'lesson',value:lesson});return lesson;});
 const first=manager.start('teacher',{id:'c1'},'目标');const second=manager.start('teacher',{id:'c1'},'目标');assert.equal(first.id,second.id);assert.equal(calls,1);assert.equal(manager.status(first.id,'teacher').status,'running');
 release();await new Promise(r=>setImmediate(r));const result=manager.status(first.id,'teacher');assert.equal(result.status,'completed');assert.equal(result.progress,100);assert.equal(result.lesson.id,'l1');assert.throws(()=>manager.status(first.id,'judge'));
});
test('阶段百分比持久化；失败保留阶段进度且不显示100%',async()=>{
 let reject;const {manager}=store(async(c,g,o,update)=>{update({progress:35,stage:'模型正在生成'});await new Promise((resolve,r)=>reject=r);});
 const first=manager.start('teacher',{id:'progress-clip'},'目标');assert.equal(manager.status(first.id,'teacher').progress,35);assert.equal(manager.status(first.id,'teacher').stage,'模型正在生成');
 reject(Error('请求超时'));await new Promise(r=>setImmediate(r));const failed=manager.status(first.id,'teacher');assert.equal(failed.status,'failed');assert.equal(failed.progress,35);assert.notEqual(failed.progress,100);
});
test('模型失败持久化为failed，允许下一次主动重试',async()=>{
 const {manager}=store(async()=>{throw Error('中转模型超时');});const first=manager.start('teacher',{id:'c1'},'目标');await new Promise(r=>setImmediate(r));assert.equal(manager.status(first.id,'teacher').status,'failed');assert.match(manager.status(first.id,'teacher').error,/超时/);const next=manager.start('teacher',{id:'c1'},'目标');assert.notEqual(next.id,first.id);await new Promise(r=>setImmediate(r));
});
