import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModelService, MODEL_ENDPOINT, networkFailure } from '../server/model-service.mjs';
test('网络失败区分超时、DNS与连接重置，不回显底层敏感信息',()=>{
 assert.match(networkFailure({name:'TimeoutError'},180000).message,/180 秒/);
 assert.match(networkFailure({cause:{code:'ENOTFOUND'}},60000).message,/DNS/);
 assert.match(networkFailure({cause:{code:'ECONNRESET'}},60000).message,/重置/);
 assert.doesNotMatch(networkFailure({message:'secret',cause:{code:'unknown'}},60000).message,/secret/);
});
test('连接重置有限重试，超时不盲目重复计费请求',async()=>{
 let count=0;const s=setup(async()=>{count++;if(count===1)throw {cause:{code:'ECONNRESET'}};return {ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}'}}]})};});
 s.save({model:'qwen3.8-max',key:'test-only-key'});assert.equal((await s.call('text',[])).ok,true);assert.equal(count,2);
 const t=setup(async()=>{throw {name:'TimeoutError'};});t.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(t.call('text',[]),/60 秒/);
});
function setup(fetchImpl){let value;return createModelService({read:()=>value,write:v=>value=v,env:{},fetchImpl});}
test('长篇生成可以提高输出预算，截断JSON不误报为成功',async()=>{
 const s=setup(async(url,options)=>{assert.equal(JSON.parse(options.body).max_tokens,6144);return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{"slides":['}}]})};});s.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(s.call('text',[],false,{maxTokens:6144,timeoutMs:180000}),/长度上限/);
});
test('524上游超时不重复请求，明确提示并发取消信号可传入',async()=>{
 let calls=0;const s=setup(async()=>{calls++;return {ok:false,status:524};});s.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(s.call('text',[]),/上游模型超时/);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();const t=setup(async(url,options)=>{assert.equal(options.signal.aborted,true);throw {name:'AbortError'};});t.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(t.call('text',[],false,{signal:controller.signal}));
});
test('使用用户提供的新域名，旧域名验证结果自动失效',()=>{
 assert.equal(MODEL_ENDPOINT,'https://token.agentone.work/v1/chat/completions');
 const service=createModelService({read:()=>({model:'qwen3.8-max',key:'test-only-key',vision:true,verified:'old'}),write:()=>{},env:{}});
 assert.equal(service.status().configured,true);assert.equal(service.status().vision,false);assert.equal(service.status().verified,null);
});
test('单密钥保存、不回显、空值保留、修改后清除验证',()=>{
 const s=setup();assert.throws(()=>s.save({model:'qwen3.8-max',key:''}));
 s.save({model:'qwen3.8-max',key:'test-only-key'});assert.equal(JSON.stringify(s.status()).includes('test-only-key'),false);
 s.save({model:'other',key:''});assert.equal(s.status().configured,true);assert.equal(s.status().vision,false);
});
test('401 不重试，不暴露上游响应体，固定 HTTPS 地址',async()=>{
 let count=0;const s=setup(async(url,opts)=>{count++;assert.equal(url,MODEL_ENDPOINT);assert.equal(opts.redirect,'error');return {ok:false,status:401};});
 s.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(s.call('text',[]),/HTTP 401/);assert.equal(count,1);
});
test('文本可用而图像失败时保留人工路径',async()=>{
 let count=0;const s=setup(async()=>++count===1?{ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}'}}]})}:{ok:false,status:400});
 s.save({model:'qwen3.8-max',key:'test-only-key'});const result=await s.test();assert.equal(result.text,true);assert.equal(result.vision,false);assert.ok(result.verified);
 await assert.rejects(s.call('vision',[]),/图像能力/);
});
test('模型无效 JSON 拒绝保存生成结果',async()=>{
 const s=setup(async()=>({ok:true,json:async()=>({choices:[{message:{content:'无结构输出'}}]})}));s.save({model:'qwen3.8-max',key:'test-only-key'});await assert.rejects(s.call('text',[]),/格式无效/);
});
test('重复保存相同模型密钥保留图像验证；测试期间不临时关闭已验证能力',async()=>{
 let value={model:'qwen3.8-flash',key:'test-only-key',endpoint:MODEL_ENDPOINT,vision:true,verified:'previous'};
 const service=createModelService({read:()=>value,write:v=>value=v,env:{},fetchImpl:async()=>{assert.equal(service.status().vision,true);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({ok:true,color:'red'})}}]})};}});
 assert.equal(service.save({model:value.model,key:''}).vision,true);assert.equal((await service.test()).vision,true);
});
