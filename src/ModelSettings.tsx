import { useState } from 'react';
import { api } from './api';
import type { Config, User } from './types';

export function ModelSettings({config,user,refresh}:{config:Config;user:User;refresh:()=>Promise<void>}) {
 const [model,setModel]=useState(config.model),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(test=false){setBusy(true);setMessage('');try{
  if(test){const result=await api<{message:string}>('/config/model/test',{});setMessage(result.message);}
  else {await api('/config/model',{model,key});setKey('');setMessage('设置已保存，请测试模型能力。');}
  await refresh();
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <form onSubmit={e=>{e.preventDefault();void run();}}>
  <p>服务：token.agentone.work · 一个模型用于镜头分析、备课和批改。</p>
  <label>模型名称<input aria-label="模型名称" value={model} onChange={e=>setModel(e.target.value)} disabled={busy||user.role!=='teacher'} required maxLength={120}/></label>
  <label>API Key<input aria-label="API Key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={busy||user.role!=='teacher'} placeholder={config.configured?'已保存，留空保留':'请输入服务商 API Key'}/></label>
  <p>测试会发送合成文本和本地像素图片，可能产生少量费用。保存后图像能力需重新验证。</p>
  <div className="result-footer"><button className="primary" disabled={busy||user.role!=='teacher'}>保存设置</button><button type="button" className="subtle" disabled={busy||!config.configured||!!key||model!==config.model||user.role!=='teacher'} onClick={()=>void run(true)}>测试文本与图像能力</button></div>
  {message&&<p role="status">{message}</p>}
  <small>{config.verified?'最近文本探测：'+new Date(config.verified).toLocaleString():'尚未验证真实模型连接'}</small>
 </form>;
}
