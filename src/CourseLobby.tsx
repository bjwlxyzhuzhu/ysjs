import {useEffect,useState} from 'react';
import {BookOpen,Plus,ArrowRight} from 'lucide-react';
import {api} from './api';
import type {Course,User} from './types';
export function CourseLobby({user,onEnter}:{user:User;onEnter:(user:User)=>void}){
 const [courses,setCourses]=useState<Course[]>(user.courses||[]),[name,setName]=useState(''),[label,setLabel]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void api<Course[]>('/courses').then(setCourses).catch(e=>setError(e.message));},[]);
 async function enter(c:Course){setBusy(true);setError('');try{await api('/courses/'+c.id+'/select',{});onEnter(await api<User>('/me'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="course-lobby"><div className="section-head"><div><span className="review-eyebrow">我的教学空间</span><h2>选择这次要备的课程</h2><p>同一账号可管理多门课程，素材、资料和作业按课程分别保存。</p></div></div><div className="course-cards">{courses.map(c=><button disabled={busy} className="glass course-card" key={c.id} onClick={()=>void enter(c)}><BookOpen size={27}/><h3>{c.name}</h3><p>{c.label||'教师课程空间'}</p><span>进入课程 <ArrowRight size={16}/></span></button>)}<form className="glass course-card" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const c=await api<Course>('/courses',{name,label});setCourses(await api<Course[]>('/courses'));setName('');setLabel('');setBusy(false);await enter(c);}catch(e){setError((e as Error).message);setBusy(false);}}}><Plus size={25}/><h3>添加我的课程</h3><label>课程名称<input aria-label="我的课程名称" value={name} onChange={e=>setName(e.target.value)} maxLength={60} required placeholder="例如：国际中文教育、大学英语"/></label><label>课程简介（可选）<input aria-label="我的课程简介" value={label} onChange={e=>setLabel(e.target.value)} maxLength={60}/></label><button className="primary" disabled={busy}>{busy?'正在进入…':'添加并进入'}</button></form></div>{error&&<p className="error" role="alert">{error}</p>}</section>;
}
