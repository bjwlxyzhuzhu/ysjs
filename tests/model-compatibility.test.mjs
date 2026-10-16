import {test} from 'node:test';import assert from 'node:assert/strict';import {inflateSync} from 'node:zlib';
import {createModelService,MODEL_ENDPOINT} from '../server/model-service.mjs';import {visualProbeImage,probeMatches,parseModelJSON} from '../server/model-probe.mjs';
const response=raw=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(raw)}}]})});
test('未知/旧失败图像状态可直接发送图像，不伪造探测成功',async()=>{
 let value={model:'qwen3.8-flash',key:'fixture-key',endpoint:MODEL_ENDPOINT,vision:false,verified:'old-text-only'},calls=0;const service=createModelService({read:()=>value,write:v=>value=v,env:{},fetchImpl:async(url,opts)=>{calls++;assert.equal(JSON.parse(opts.body).messages[0].content[1].type,'image_url');return response({composition:'真实测试图形'});}});
 assert.equal(service.status().vision,false);assert.equal(service.status().can_analyze_images,true);assert.equal((await service.call('vision',[{role:'user',content:[{type:'text',text:'观察'},{type:'image_url',image_url:{url:visualProbeImage()}}]}])).composition,'真实测试图形');assert.equal(calls,1);assert.equal(service.status().vision,false);
});
test('503不永久禁用图像；探测与真实请求独立，恢复后可再次验证',async()=>{
 let value={model:'qwen3.8-flash',key:'fixture-key',endpoint:MODEL_ENDPOINT,vision:true,verified:'previous'},busy=true;const service=createModelService({read:()=>value,write:v=>value=v,env:{},wait:async()=>{},fetchImpl:async(url,o)=>Array.isArray(JSON.parse(o.body).messages[0].content)?busy?{ok:false,status:503,text:async()=>'{"error":"private-token-must-not-leak"}'}:response({left:'红色',right:'蓝色'}):response({ok:true})});
 const failed=await service.test();assert.equal(failed.vision_state,'unavailable');assert.equal(failed.can_analyze_images,true);assert.equal(failed.vision,true);assert.match(failed.message,/HTTP 503/);assert.doesNotMatch(JSON.stringify(failed),/private-token/);busy=false;assert.equal((await service.test()).vision_state,'verified');
});
test('文本探测失败仍测试图像，重复点击共享同一次探测',async()=>{
 let value={model:'qwen3.8-flash',key:'fixture-key',endpoint:MODEL_ENDPOINT},calls=0;const service=createModelService({read:()=>value,write:v=>value=v,env:{},wait:async()=>{},fetchImpl:async(url,o)=>{calls++;return Array.isArray(JSON.parse(o.body).messages[0].content)?response({left:'red',right:'blue'}):{ok:false,status:503};}});const [a,b]=await Promise.all([service.test(),service.test()]);assert.equal(a.text_probe.state,'unavailable');assert.equal(a.vision_state,'verified');assert.deepEqual(a,b);assert.equal(calls,3);
});
test('仅明确拒绝response_format时有限兼容重试，保留图像输入并缓存成功兼容方式',async()=>{
 let value={model:'qwen3.8-flash',key:'fixture-key',endpoint:MODEL_ENDPOINT},calls=[];const service=createModelService({read:()=>value,write:v=>value=v,env:{},fetchImpl:async(url,o)=>{const body=JSON.parse(o.body);calls.push(body);return body.response_format?{ok:false,status:400,text:async()=>'Unsupported parameter response_format json_object'}:response({ok:true});}});
 const messages=[{role:'user',content:[{type:'image_url',image_url:{url:visualProbeImage()}}]}];await service.call('vision',messages);assert.equal(calls.length,2);assert.deepEqual(calls[0].messages,calls[1].messages);assert.equal(value.json_mode,'plain');await service.call('vision',messages);assert.equal(calls.length,3);assert.equal(calls[2].response_format,undefined);
});
test('明确图像不支持与暂时故障区分；重测可恢复；配置变更不污染新配置',async()=>{
 let value={model:'qwen3.8-flash',key:'fixture-key',endpoint:MODEL_ENDPOINT};const service=createModelService({read:()=>value,write:v=>value=v,env:{},fetchImpl:async(url,o)=>Array.isArray(JSON.parse(o.body).messages[0].content)?{ok:false,status:400,text:async()=>'This model does not support image input'}:response({ok:true})});assert.equal((await service.test()).can_analyze_images,false);await assert.rejects(service.call('vision',[]),e=>e.code==='image_unsupported');
 let writes=0;const changed=createModelService({read:()=>value,write:()=>writes++,env:{},fetchImpl:async()=>{value={...value,model:'different-model'};return response({ok:true});}});await assert.rejects(changed.test(),/配置已改变/);assert.equal(writes,0);
});
test('探测PNG可解码且双色位置正确；中文颜色、分段内容、说明包裹JSON兼容但截断与数组拒绝',()=>{
 const b=Buffer.from(visualProbeImage().split(',')[1],'base64');assert.equal(b.readUInt32BE(16),256);assert.equal(b.readUInt32BE(20),128);let i=8,parts=[];while(i<b.length){const n=b.readUInt32BE(i);if(b.toString('ascii',i+4,i+8)==='IDAT')parts.push(b.subarray(i+8,i+8+n));i+=n+12;}const pixels=inflateSync(Buffer.concat(parts));assert.equal(pixels.length,(256*3+1)*128);assert.equal(pixels[1],255);assert.equal(pixels[1+128*3+2],255);assert(probeMatches({left:'红色',right:'蓝色'}));assert.deepEqual(parseModelJSON([{type:'text',text:'说明\n```json\n{"ok":true}\n```'}]),{ok:true});assert.throws(()=>parseModelJSON('{"unfinished":'));assert.throws(()=>parseModelJSON('{"unfinished":{"ok":true}'));assert.throws(()=>parseModelJSON('说明\n{"unfinished":{"ok":true}'));assert.throws(()=>parseModelJSON('[{"ok":true}]'));
});
