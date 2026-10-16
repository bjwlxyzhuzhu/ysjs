import {visualProbeImage,parseModelJSON,probeMatches} from './model-probe.mjs';
export const MODEL_ENDPOINT='https://token.agentone.work/v1/chat/completions';
const failure=(message,code,status=502,extra={})=>Object.assign(Error(message),{status,code,...extra});
export function networkFailure(error,timeoutMs){
 const code=error?.cause?.code||error?.code,timeout=['TimeoutError','AbortError'].includes(error?.name),reasons={ENOTFOUND:'接口域名 DNS 解析失败',EAI_AGAIN:'接口域名 DNS 暂时不可用',ECONNRESET:'中转服务连接被重置',ECONNREFUSED:'中转服务拒绝连接',UND_ERR_CONNECT_TIMEOUT:'连接中转服务超时',UND_ERR_HEADERS_TIMEOUT:'等待中转服务响应头超时',ETIMEDOUT:'连接中转服务超时'};
 return failure(timeout?`模型请求超过 ${timeoutMs/1000} 秒仍未完成；小图连通不代表三帧分析能及时返回`:(reasons[code]||'模型网络连接失败，未收到有效响应；请检查中转服务或本机网络'),timeout?'model_timeout':'model_network',502,{transient:true});
}
async function errorText(r){try{if(r.text)return (await r.text()).slice(0,12000);if(r.json)return JSON.stringify(await r.json()).slice(0,12000);}catch{}return '';}
function upstreamFailure(status,body){
 if(status===503&&/no.available.channel|no_available_channel|无可用(?:的)?(?:通道|渠道)|没有可用(?:的)?(?:通道|渠道)/i.test(body))return failure('中转站返回503：当前模型分组没有可用通道，请服务商检查所选模型的分组授权、模型映射和通道状态；这不等于 API Key 填写错误','model_channel_unavailable',502,{transient:true,upstream_status:status});
 if([400,422].includes(status)&&/does not support (?:image|vision)|image (?:input|url|content).*not supported|unsupported.*(?:image|vision)|不支持(?:图片|图像|视觉)/i.test(body))return failure('中转站当前模型通道明确拒绝图像输入，请核对所选模型的多模态通道路由后重新测试','image_unsupported',502,{upstream_status:status});
 if([503,502,500].includes(status))return failure(`中转服务暂不可用（HTTP ${status}），可能是上游拥堵或可用通道不足；已有标注保留，可稍后恢复分析。此错误不代表模型不支持图片`,'upstream_unavailable',502,{transient:true,upstream_status:status});
 if([504,524].includes(status))return failure(`中转服务等待上游模型超时（HTTP ${status}）；请稍后恢复分析，已有结果保留`,'upstream_timeout',502,{transient:true,upstream_status:status});
 if(status===429)return failure('模型服务限流或额度不足（HTTP 429），请稍后重试或检查中转账户额度','model_rate_limit',502,{transient:!/insufficient_quota|quota.*exceed|余额不足/i.test(body),upstream_status:status});
 if([401,403].includes(status))return failure(`中转服务拒绝认证或权限（HTTP ${status}），请检查 API Key 与模型权限`,'model_auth',502,{upstream_status:status});
 return failure(`模型接口返回 HTTP ${status}，请检查模型通道路由及请求兼容性`,'model_request',502,{upstream_status:status});
}
export function createModelService({read,write,fetchImpl=fetch,env=process.env,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const settings=()=>{const s=read()||{model:env.MODEL_NAME||'qwen3.8-max',key:env.MODEL_API_KEY||'',vision:false};return s.endpoint===MODEL_ENDPOINT?s:{...s,endpoint:MODEL_ENDPOINT,vision:false,verified:null,vision_probe:null,text_probe:null};};
 const status=()=>{const s=settings(),configured=!!s.key,state=!configured?'not_configured':s.vision_probe?.state||(s.vision===true?'verified':'untested');return {provider:'token.agentone.work',model:s.model,configured,text:configured,vision:configured&&s.vision===true,can_analyze_images:configured&&state!=='unsupported',vision_state:state,vision_probe:s.vision_probe||null,text_probe:s.text_probe||null,verified:s.verified||null};};
 const same=(a,b)=>a.key===b.key&&a.model===b.model&&a.endpoint===b.endpoint;
 async function call(kind,messages,probe=false,options={}){
  const s=settings();if(!s.key)throw failure('请先配置模型名称和 API Key','model_not_configured',503);
  if(kind==='vision'&&!probe&&status().vision_state==='unsupported')throw failure('当前通道明确拒绝图片，请在模型设置中重新测试图像能力','image_unsupported',502);
  const timeoutMs=options.timeoutMs||(kind==='vision'&&!probe?180000:60000),signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);let format=s.json_mode!=='plain',compatRetried=false,temporaryRetries=0;
  while(true){
   if(signal.aborted)throw options.signal?.aborted?failure('请求已停止，原有结果保留','model_cancelled',409):networkFailure({name:'TimeoutError'},timeoutMs);let response;
   try{response=await fetchImpl(MODEL_ENDPOINT,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+s.key,'Content-Type':'application/json'},body:JSON.stringify({model:s.model,messages,temperature:.2,max_tokens:options.maxTokens||2048,...(format?{response_format:{type:'json_object'}}:{})}),signal});}
   catch(e){if(options.signal?.aborted)throw failure('请求已停止，原有结果保留','model_cancelled',409);if(temporaryRetries===0&&['ECONNRESET','EAI_AGAIN'].includes(e?.cause?.code||e?.code)){temporaryRetries++;await wait(500);continue;}throw networkFailure(e,timeoutMs);}
   if(!response.ok){
    const body=await errorText(response);
    if(format&&!compatRetried&&[400,422].includes(response.status)&&/response_format|json_object/i.test(body)&&/unsupported|not support|invalid|unknown|不支持|无效/i.test(body)){format=false;compatRetried=true;continue;}
    const error=upstreamFailure(response.status,body);if(temporaryRetries===0&&[429,500,502,503].includes(response.status)&&error.transient){temporaryRetries++;const retry=Number(response.headers?.get?.('retry-after'));await wait(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,3000):1000);continue;}throw error;
   }
   try{const data=await response.json(),choice=data.choices?.[0];if(choice?.finish_reason==='length')throw failure('模型输出达到长度上限，未保存不完整结果，请缩短任务后重试','model_truncated');const parsed=parseModelJSON(choice?.message?.content);if(compatRetried){const now=settings();if(same(now,s))write({...now,json_mode:'plain'});}return parsed;}
   catch(e){if(e?.code&&e?.status)throw e;if(e?.name==='TimeoutError'||e?.name==='AbortError'||e?.cause?.code)throw networkFailure(e,timeoutMs);throw failure('模型返回格式无效，未保存生成结果；可重试或改为人工校订','model_format');}
  }
 }
 function save(input){
  if(typeof input.model!=='string'||!/^[\w./:-]{1,120}$/.test(input.model))throw failure('模型名称格式无效','invalid_model',400);if(typeof input.key!=='string'||input.key.length>4096||/[\r\n]/.test(input.key))throw failure('API Key 格式无效','invalid_key',400);
  const current=settings(),key=input.key.trim()||current.key;if(key&&input.model===current.model&&key===current.key)return status();if(!key)throw failure('首次配置需要输入 API Key','invalid_key',400);write({model:input.model,key,endpoint:MODEL_ENDPOINT,vision:false});return status();
 }
 let testing=null;
 async function runTest(){
  const tested=settings();if(!tested.key)throw failure('请先配置模型名称和 API Key','model_not_configured',503);const stamp=()=>new Date().toISOString();let textProbe,visionProbe,vision=tested.vision===true;
  try{const result=await call('text',[{role:'user',content:'仅返回 JSON：{"ok":true}'}],true);if(result.ok!==true)throw failure('文本探测未返回约定结果','probe_mismatch');textProbe={state:'verified',checked_at:stamp(),message:'文本探测通过'};}catch(e){textProbe={state:'unavailable',checked_at:stamp(),code:e.code||'model_request',message:e.message};}
  if(!same(settings(),tested))throw failure('测试期间模型配置已改变，请重新测试','model_changed',409);
  try{const result=await call('vision',[{role:'user',content:[{type:'text',text:'观察图片左半部分和右半部分的主要颜色。仅返回JSON：{"left":"颜色名称","right":"颜色名称"}。可用中文或英文，不确定写unknown。'},{type:'image_url',image_url:{url:visualProbeImage()}}]}],true);if(!probeMatches(result))throw failure('图像已返回结果，但颜色探测未匹配；可尝试实际镜头识别或重新测试','probe_mismatch');vision=true;visionProbe={state:'verified',checked_at:stamp(),last_success:stamp(),message:'图像探测通过'};}
  catch(e){const unsupported=e.code==='image_unsupported';if(unsupported)vision=false;visionProbe={state:unsupported?'unsupported':'unavailable',checked_at:stamp(),last_success:tested.vision_probe?.last_success||(tested.vision?tested.verified:null),code:e.code||'model_request',message:e.message};}
  const now=settings();if(!same(now,tested))throw failure('测试期间模型配置已改变，请重新测试','model_changed',409);write({...now,vision,text_probe:textProbe,vision_probe:visionProbe,verified:textProbe.state==='verified'?textProbe.checked_at:tested.verified||null});return {...status(),message:[textProbe.state==='verified'?'文本探测通过':textProbe.message,visionProbe.state==='verified'?'图像探测通过，教学判断仍需教师复核':visionProbe.message].join('；')};
 }
 function test(){if(!testing)testing=runTest().finally(()=>{testing=null;});return testing;}
 return {status,save,call,test};
}
