import {useState} from 'react';
import {Clapperboard,BookOpen,ClipboardCheck,ChartNoAxesCombined,ArrowRight,Sparkles,PanelRightOpen} from 'lucide-react';
import {api} from './api';
import {sourceName} from './MaterialLibrary';
import {ReviewDrawer} from './ReviewDrawer';
import type {User,Page,Knowledge,Config} from './types';
export const agentCards=[{id:'shot',name:'镜析',title:'片段教学智能体',page:'拉片工作台' as Page,icon:Clapperboard,description:'从关键帧与课程资料中提炼教学价值。',placeholder:'分析已复核片段适合讲解哪些知识点，并设计三道课堂提问。'}, {id:'lesson',name:'课织',title:'教案讲义智能体',page:'备课生成' as Page,icon:BookOpen,description:'用大纲、课件和教案编织一堂完整的课。',placeholder:'依据我上传的教学大纲和课件，编写本课教案与学生讲义。'}, {id:'grading',name:'阅衡',title:'作业批改智能体',page:'作业批改' as Page,icon:ClipboardCheck,description:'参考试卷、习题与批改范例，校准评价。',placeholder:'参考我的试卷、习题及批改记录，设计评价量规和反馈范例。'}, {id:'learning',name:'学迹',title:'学情分析智能体',page:'成效看板' as Page,icon:ChartNoAxesCombined,description:'把已复核成绩转化为可行动的教学调整。',placeholder:'分析本课程已复核作业的薄弱环节，提出下一次课的调整方案。'}];
export function AgentRoster({onOpen}:{onOpen:()=>void}){return <div className="agent-roster">{agentCards.map(a=><button key={a.id} onClick={onOpen}><a.icon size={23}/><strong>{a.name}<small>{a.title}</small></strong><p>{a.description}</p><span>进入智能体工作室 <ArrowRight size={13}/></span></button>)}</div>;}
type Reply={agent:string;answer:string;sources:Knowledge[]};
export function AgentStudio({user,config,navigate}:{user:User;config:Config|null;navigate:(p:Page)=>void}){
  const [id,setId]=useState('lesson'),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<Reply|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false),[tab,setTab]=useState('answer');
  const agent=agentCards.find(a=>a.id===id)!;
  async function ask(){setBusy(true);setError('');setOpen(false);try{setResult(await api<Reply>('/agents/'+id+'/ask',{question}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function show(initial:string){setTab(initial);setOpen(true);}
  return <div className="feature-page"><div className="page-title"><span><Sparkles size={22}/></span><div><h1>教师智能体工作室</h1><p>{user.course?.name} · 四个角色，协同每一堂课。</p></div></div>
    <div className="agent-tabs">{agentCards.map(a=><button key={a.id} className={a.id===id?'active':''} disabled={busy} onClick={()=>{setId(a.id);setResult(null);setOpen(false);setError('');setQuestion('');}}><a.icon size={22}/><b>{a.name}</b><small>{a.title}</small></button>)}</div>
    <div className="agent-workspace"><section className="form-panel glass"><h2>{agent.name} · {agent.title}</h2><label>本次教学任务<textarea aria-label="智能体任务" rows={5} maxLength={4000} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)} placeholder={agent.placeholder}/></label><button className="text-button" disabled={busy} onClick={()=>setQuestion(agent.placeholder)}>使用示例任务</button><button className="primary full" disabled={busy||!question.trim()||!config?.text||user.role!=='teacher'} onClick={()=>void ask()}><Sparkles size={16}/>{busy?'正在结合课程资料生成…':'请'+agent.name+'协助'}</button><button className="subtle full" disabled={busy} onClick={()=>navigate(agent.page)}>进入{agent.page}<ArrowRight size={15}/></button>{id==='lesson'&&<button className="text-button" disabled={busy} onClick={()=>navigate('布置作业')}>进入布置作业</button>}<button className="text-button" disabled={busy} onClick={()=>navigate('课程知识库')}>管理课程资料</button><details className="review-help"><summary>智能体如何使用我的资料</summary><p>采用检索增强，未进行模型参数微调。四个角色共用已配置模型和一个API Key；学迹只使用已复核成绩汇总。建议仍需教师核对。</p></details></section>
      <section className="glass agent-answer">{error&&<div className="error" role="alert">{error}</div>}{busy&&<div className="analysis-progress"><strong>{agent.name}正在工作</strong><div className="progress-track indeterminate"><i style={{width:'30%'}}/></div><p>正在检索课程资料并组织回答。</p></div>}
        {result?<><div className="result-heading"><h2>{result.agent}的教学建议</h2><span className="warning">AI建议 · 待教师校订</span></div><div className="agent-answer-summary"><span className="review-eyebrow">课程资料 → 角色任务 → 教师决策</span><p className="review-preview">{result.answer.slice(0,180)}{result.answer.length>180?'…':''}</p><div className="agent-metrics"><span>{result.sources.length}条资料依据</span><span>{user.course?.name}</span></div><div className="review-summary-actions"><button className="primary" onClick={()=>show('answer')}><PanelRightOpen size={16}/>查看完整建议</button><button className="subtle" onClick={()=>show('sources')}>核对课程依据</button></div></div></>:!busy&&<div className="large-empty"><agent.icon size={42}/><h2>请{agent.name}协助本次教学</h2><p>先提出任务，展开建议时核对资料。</p></div>}
      </section>
    </div>
    {result&&<ReviewDrawer open={open} onClose={()=>setOpen(false)} title={result.agent+' · 教学建议'} subtitle={user.course?.name+' · AI建议需教师校订'} initialTab={tab} tabs={[
      {id:'answer',label:'教学建议',content:<div className="original-text">{result.answer}</div>},
      {id:'sources',label:'课程依据',content:<><h3>模型返回的资料引用</h3>{result.sources.length?result.sources.map(k=><article className="review-source-card" key={k.id}><b>{k.title}</b><small>{sourceName(k)} · {k.id}</small><p>{k.excerpt||k.summary}</p></article>):<p>本次没有引用资料，请检查知识库并补充具体任务。</p>}</>},
      {id:'scope',label:'使用边界',content:<><h3>教师主导，智能体协助</h3><p>资料按教师与课程隔离。引用ID已检查属于本次检索资料，但仍需核对建议是否正确使用资料。未提供的画面、声音和教学成效不可作为已验证事实。</p><p>本页建议不替代正式评分复核；作业成绩以阅衡批改工作台中教师确认的记录为准。采用知识检索增强，没有进行模型参数微调。</p></>}
    ]}/>}
  </div>;
}
