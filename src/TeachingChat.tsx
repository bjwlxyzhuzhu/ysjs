import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { api } from './api';
import type { Shot } from './types';
type Message={role:'user'|'assistant';content:string};
export function TeachingChat({clipId,shot}:{clipId:string;shot?:Shot}){
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const log=useRef<HTMLDivElement>(null),active=useRef(clipId);
 useEffect(()=>{active.current=clipId;setMessages([]);setError('');setInput('');},[clipId]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,busy,open]);
 async function send(){const q=input.trim();if(!q||busy)return;const id=clipId;setOpen(true);setError('');setBusy(true);const next:Message[]=[...messages,{role:'user',content:q}];setMessages(next);setInput('');try{
  const result=await api<{answer:string;knowledge_ids:string[]}>('/clips/'+id+'/chat',{question:q,shot_id:shot?.id,history:messages.slice(-8).map(m=>({...m,content:m.content.slice(0,6000)}))});
  if(active.current===id)setMessages([...next,{role:'assistant',content:result.answer+(result.knowledge_ids.length?'\n\n课程依据：'+result.knowledge_ids.join('、'):'')}]);
 }catch(e){if(active.current===id){setError((e as Error).message);setInput(q);}}finally{setBusy(false);}}
 const composer=<form onSubmit={e=>{e.preventDefault();void send();}} className="chat-compose"><textarea aria-label="向教学助教提问" placeholder="例如：如何用当前片段设计课堂讨论？Enter 发送，Shift+Enter 换行" value={input} maxLength={4000} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button className="primary" aria-label="发送教学问题" disabled={busy||!input.trim()}><Send size={18}/>{busy?'正在思考…':'发送'}</button></form>;
 return <><button className="chat-open" onClick={()=>setOpen(true)}><MessageSquare size={19}/>打开镜析教学对话<span>联系当前片段，讨论教学设计</span></button>{open&&<><div className="chat-shade" onClick={()=>setOpen(false)}/><aside className="teaching-chat" aria-label="教学助教对话" role="dialog"><header><div><h2>镜析 · 片段教学智能体</h2><small>{shot?'当前教学片段 #'+shot.index:'当前视频'} · AI建议需教师复核</small></div><button aria-label="关闭教学对话" onClick={()=>setOpen(false)}><X size={20}/></button></header><div className="chat-log" ref={log} aria-live="polite">{!messages.length&&<p className="muted">可围绕镜头解读、叙事结构、课堂导入或讨论题连续提问。当前关键帧及脱敏文字会发送至已配置模型服务。</p>}{messages.map((m,i)=><article key={i} className={'chat-message '+m.role}><b>{m.role==='user'?'教师':'镜析'}</b><p>{m.content}</p></article>)}{busy&&<p role="status">正在结合片段分析，请稍候…</p>}{error&&<div className="error" role="alert">{error}。问题已保留，可重新发送。</div>}</div>{composer}</aside></>}</>;
}
