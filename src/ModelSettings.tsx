import { useState } from 'react';
import { api } from './api';
import type { Config, User } from './types';

export function ModelSettings({config,user,refresh}:{config:Config;user:User;refresh:()=>Promise<void>}) {
 const [model,setModel]=useState(config.model),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(test=false){setBusy(true);setMessage('');try{
  if(test){const result=await api<Config&{message:string}>('/config/model/test',{});setMessage((result.text_probe?.state==='verified'?'文本探测通过':'文本探测未通过')+'；'+(result.vision_state==='verified'?'图像探测通过，请复核实际教学分析':'图像探测未通过，详情见连接状态。'));}
  else {await api('/config/model',{model,key});setKey('');setMessage('设置已保存，可测试连接或直接尝试镜头识别。');}
  await refresh();
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <form onSubmit={e=>{e.preventDefault();void run();}}>
  <p>服务：token.agentone.work · 一个模型用于镜头分析、备课和批改。</p>
  <label>模型名称<input aria-label="模型名称" value={model} onChange={e=>setModel(e.target.value)} disabled={busy||user.role!=='teacher'} required maxLength={120}/></label>
  <label>API Key<input aria-label="API Key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={busy||user.role!=='teacher'} placeholder={config.configured?'已保存，留空保留':'请输入服务商 API Key'}/></label>
  <p>测试仅发送合成文本和256像素双色图片，可能产生少量费用。文本与图像独立验证；暂时失败不等于模型不支持图片，实际镜头识别仍可尝试。</p>
  <div className="service-row"><span>图像连接状态</span><b>{config.vision_state==='verified'?'探测通过':config.vision_state==='unavailable'?'暂不可用，可重试':config.vision_state==='unsupported'?'当前通道拒绝图片':config.configured?'待验证，可尝试识别':'待配置'}</b></div>
  {config.vision_probe?.message&&config.vision_state!=='verified'&&<p role="status">{config.vision_probe.message}</p>}
  <div className="result-footer"><button className="primary" disabled={busy||user.role!=='teacher'}>保存设置</button><button type="button" className="subtle" disabled={busy||!config.configured||!!key||model!==config.model||user.role!=='teacher'} onClick={()=>void run(true)}>测试文本与图像能力</button></div>
  {message&&<p role="status">{message}</p>}
  <small>{config.text_probe?.state==='verified'?'最近文本探测通过：'+new Date(config.text_probe.checked_at).toLocaleString():config.text_probe?'文本连接暂不可用，可重新测试':'文本连接待验证'}<br/>{config.vision_probe?.last_success?'最近图像探测通过：'+new Date(config.vision_probe.last_success).toLocaleString():'尚无图像探测通过记录'}</small>
 </form>;
}
