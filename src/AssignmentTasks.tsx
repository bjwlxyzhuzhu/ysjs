import {useEffect,useState} from 'react';
import {ClipboardList,Plus,Save,Send,Download,Sparkles,Upload,ArrowRight,Trash2} from 'lucide-react';
import {api} from './api';
import type {AssignmentTask,TaskForm,Clip,Config,User} from './types';
import './assignment-tasks.css';
import {ReviewDrawer} from './ReviewDrawer';

const now=new Date(),startYear=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;
export const academicYears=Array.from({length:11},(_,i)=>`${startYear-5+i}-${startYear-4+i}`);
export function parseRoster(value:string){
  const lines=value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),seen=new Set<string>();
  return lines.filter((line,i)=>!(i===0&&/学号|student_id/i.test(line))).map((line,i)=>{
    const cells=line.split(/[\t,，]|\s+/).map(s=>s.trim().replace(/^"|"$/g,''));
    if(cells.length!==2||!cells[0]||!cells[1])throw Error(`名单第${i+1}行需为“学号 姓名”，可用空格、逗号或Tab分隔`);
    if(seen.has(cells[0]))throw Error('名单有重复学号：'+cells[0]);seen.add(cells[0]);return {student_id:cells[0],student_name:cells[1]};
  });
}
function emptyForm(config:Config|null):TaskForm{return {title:'',class_name:'',academic_year:`${startYear}-${startYear+1}`,semester:now.getMonth()>=7?'一':'二',goal:'',instructions:'',submission_requirements:'提交Word文档，文件名为“学号_姓名_作业名称”。',deadline:null,clip_id:null,roster:[],rubric:(config?.rubric||[]).map(r=>({...r,criteria:''})),knowledge_ids:[]};}
const deadlineLabel=(value:string|null)=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京时间）':'未设置';
const inputDeadline=(value:string|null)=>value?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):'';
const statusLabel={draft:'待发布草稿',published:'已发布 · 收交中',closed:'已结束收交'};

export function AssignmentTasks({user,clips,config,notify,onGrade}:{user:User;clips:Clip[];config:Config|null;notify:(s:string)=>void;onGrade:(taskId:string,submissionIds:string[])=>void}){
  const [tasks,setTasks]=useState<AssignmentTask[]>([]),[selected,setSelected]=useState<string|null>(null),[form,setForm]=useState<TaskForm>(()=>emptyForm(config)),[rosterText,setRosterText]=useState(''),[sources,setSources]=useState<AssignmentTask['sources']>([]),[dirty,setDirty]=useState(false),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[generating,setGenerating]=useState(false),[elapsed,setElapsed]=useState(0),[error,setError]=useState(''),[checked,setChecked]=useState<string[]>([]),[detailTab,setDetailTab]=useState<string|null>(null);
  const current=tasks.find(t=>t.id===selected),locked=!!current&&current.status!=='draft',disabled=busy||generating,readonly=locked||disabled;
  async function reload(){const xs=await api<AssignmentTask[]>('/assignment-tasks');setTasks(xs);return xs;}
  useEffect(()=>{if(user.role==='teacher')void reload().catch(e=>setError(e.message));},[user.role]);
  useEffect(()=>{if(!selected&&config)setForm(f=>f.rubric.length?f:{...f,rubric:config.rubric.map(r=>({...r,criteria:''}))});},[config?.rubric.map(r=>r.name).join('|')]);
  useEffect(()=>{if(!generating)return;setElapsed(0);const timer=setInterval(()=>setElapsed(s=>s+1),1000);return()=>clearInterval(timer);},[generating]);
  function select(task?:AssignmentTask){setSelected(task?.id||null);setForm(task?{...task}:emptyForm(config));setRosterText(task?.roster.map(r=>r.student_id+' '+r.student_name).join('\n')||'');setSources(task?.sources||[]);setDirty(false);setReviewed(false);setChecked([]);setError('');}
  function change<K extends keyof TaskForm>(key:K,value:TaskForm[K]){setForm(f=>({...f,[key]:value}));setDirty(true);setReviewed(false);}
  const payload=()=>({...form,roster:parseRoster(rosterText)});
  async function persist(){const task=await api<AssignmentTask>('/assignment-tasks'+(selected?'/'+selected:''),payload(),selected?'PATCH':'POST');setSelected(task.id);setForm(task);setTasks(xs=>[task,...xs.filter(t=>t.id!==task.id)]);setDirty(false);return task;}
  async function save(){setBusy(true);setError('');try{await persist();notify('作业草稿已保存');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function publish(){setBusy(true);setError('');try{const task=locked?current!:await persist();const updated=await api<AssignmentTask>('/assignment-tasks/'+task.id+'/publish',{reviewed:true});setTasks(xs=>[updated,...xs.filter(t=>t.id!==updated.id)]);setForm(updated);setReviewed(false);notify('作业已发布，可导出任务书并收交作业');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function suggest(){setGenerating(true);setError('');try{const reply=await api<Pick<AssignmentTask,'instructions'|'submission_requirements'|'rubric'|'knowledge_ids'|'sources'>>('/assignment-tasks/suggest',payload());setForm(f=>({...f,...reply}));setSources(reply.sources);setDirty(true);setReviewed(false);notify('课织已生成作业初稿，请编辑并核对后发布');}catch(e){setError((e as Error).message);}finally{setGenerating(false);}}
  async function close(){if(!current)return;setBusy(true);try{const updated=await api<AssignmentTask>('/assignment-tasks/'+current.id+'/close',{});setTasks(xs=>xs.map(t=>t.id===updated.id?updated:t));notify('已结束收交，已有作业仍可批改');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function remove(){if(!current)return;setBusy(true);try{await api('/assignment-tasks/'+current.id,{},'DELETE');setTasks(xs=>xs.filter(t=>t.id!==current.id));select();notify('草稿已删除');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const totalWeight=form.rubric.reduce((sum,r)=>sum+r.weight,0),ready=!!form.title.trim()&&!!form.class_name.trim()&&totalWeight===100;
  if(user.role!=='teacher')return <div className="feature-page"><div className="notice">布置与收交作业由教师账号操作。</div></div>;
  return <div className="feature-page assignment-page">
    <div className="page-title"><span><ClipboardList/></span><div><h1>课织 · 布置作业</h1><p>{user.course?.name} · 设计任务、教师审核、导出布置、收交与批改。</p></div></div>
    <div className="assignment-layout">
      <aside className="glass task-sidebar">
        <div className="task-sidebar-heading"><h2>课程作业任务</h2><button className="subtle" disabled={disabled||dirty} onClick={()=>select()} aria-label="新建作业"><Plus size={16}/>新建</button></div>
        {dirty&&<><p className="warning">当前有未保存编辑，请先保存草稿。</p><button className="text-button" disabled={disabled} onClick={()=>select(current)}>放弃未保存编辑</button></>}
        <div className="task-list">{tasks.length?tasks.map(t=><button className={selected===t.id?'selected':''} key={t.id} disabled={disabled||dirty} onClick={()=>select(t)}><strong>{t.title}</strong><span>{t.class_name} · {t.term}</span><small>{statusLabel[t.status]} · 已交 {t.progress.submitted}{t.progress.expected?' / '+t.progress.expected:''} · 已复核 {t.progress.reviewed}</small></button>):<p className="muted">尚无作业任务。从右侧创建第一份作业。</p>}</div>
        <div className="notice">发布代表教师已审核。通过任务书在现有班级渠道布置作业，由教师统一导入收回的Word/ZIP；平台不要求学生登录。</div>
      </aside>
      <div className="task-main">
        <section className="glass task-compact-head" hidden={!locked||!current}>{current&&<><span className="review-eyebrow">{statusLabel[current.status]}</span><h2>{current.title}</h2><div className="task-compact-meta"><div><small>课程与班级</small><span>{current.course} · {current.class_name}</span></div><div><small>学年与学期</small><span>{current.term}</span></div><div><small>截止时间</small><span>{deadlineLabel(current.deadline)}</span></div></div><p className="review-preview">{current.goal||'按任务要求完成作品分析与应用练习。'}</p><div className="review-summary-actions"><button className="subtle" onClick={()=>setDetailTab('instructions')}>查看任务与评价标准</button><button className="subtle" onClick={()=>setDetailTab('sources')}>课程依据</button><button className="subtle" onClick={()=>window.location.assign('/api/assignment-tasks/'+current.id+'/export/docx')}><Download size={16}/>导出Word任务书</button><button className="primary" disabled={disabled||current.status==='closed'} onClick={()=>onGrade(current.id,[])}><Upload size={16}/>收交学生作业</button>{current.status==='published'?<button className="text-button" disabled={disabled} onClick={()=>void close()}>结束收交</button>:<button className="text-button" disabled={disabled} onClick={()=>void publish()}>重新开放收交</button>}</div></>}</section><section className="glass task-editor" hidden={locked}>
          <div className="task-editor-heading"><h2>{current?statusLabel[current.status]:'新建作业任务'}</h2>{current?.status==='draft'&&<button className="text-button" disabled={disabled} onClick={()=>void remove()}><Trash2 size={15}/>删除草稿</button>}</div>
          <div className="task-fields">
            <label>课程<input aria-label="作业课程" value={user.course?.name||'影视鉴赏'} readOnly/></label>
            <label>班级<input aria-label="作业班级" maxLength={120} value={form.class_name} disabled={readonly} placeholder="例如：2026级汉语言1班" onChange={e=>change('class_name',e.target.value)}/></label>
            <label className="wide">作业名称<input aria-label="作业任务名称" maxLength={120} value={form.title} disabled={readonly} placeholder="例如：第一次影像证据分析" onChange={e=>change('title',e.target.value)}/></label>
            <label>学年<select aria-label="作业学年" value={form.academic_year} disabled={readonly} onChange={e=>change('academic_year',e.target.value)}>{[...new Set([...academicYears,form.academic_year])].sort().map(y=><option key={y}>{y}</option>)}</select></label>
            <label>学期<select aria-label="作业学期" value={form.semester} disabled={readonly} onChange={e=>change('semester',e.target.value)}><option value="一">第一学期</option><option value="二">第二学期</option></select></label>
            <label>截止时间（北京时间）<input aria-label="作业截止时间" type="datetime-local" value={inputDeadline(form.deadline)} disabled={readonly} onChange={e=>change('deadline',e.target.value?new Date(e.target.value+':00+08:00').toISOString():null)}/></label>
            <label>关联已复核片段（可选）<select aria-label="作业关联片段" value={form.clip_id||''} disabled={readonly} onChange={e=>change('clip_id',e.target.value||null)}><option value="">不关联视频，按课程资料出题</option>{clips.filter(c=>c.shots.length&&c.shots.every(s=>s.status==='teacher_reviewed')).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            <label className="wide">教学目标<textarea aria-label="作业教学目标" rows={3} maxLength={2000} value={form.goal} disabled={readonly} onChange={e=>change('goal',e.target.value)}/></label>
          </div>
          {!locked&&<div className="task-ai-actions"><button className="subtle" disabled={disabled||!ready||!config?.text} onClick={()=>void suggest()}><Sparkles size={16}/>{generating?'课织正在设计…':'请课织生成作业初稿'}</button><small>基于当前课程已入库资料；生成后由教师编辑审核。</small></div>}
          {generating&&<div className="analysis-progress" role="status"><strong>课织正在检索资料并组织分层作业</strong><div className="progress-track indeterminate"><i style={{width:'30%'}}/></div><p>已等待 {elapsed} 秒 · 单次模型请求最长约3分钟</p></div>}
          <label>作业内容与要求<textarea aria-label="作业内容与要求" rows={8} maxLength={12000} value={form.instructions} disabled={readonly} onChange={e=>change('instructions',e.target.value)}/></label>
          <label>提交要求<textarea aria-label="作业提交要求" rows={3} maxLength={2000} value={form.submission_requirements} disabled={readonly} onChange={e=>change('submission_requirements',e.target.value)}/></label>
          <h3>评价量规 · 权重合计 {totalWeight}%</h3>
          <div className="task-rubric">{form.rubric.map((r,i)=><div key={r.name}><label>{r.name}<input aria-label={'作业'+r.name+'权重'} type="number" min={1} max={100} step="1" value={r.weight} disabled={readonly} onChange={e=>change('rubric',form.rubric.map((x,j)=>j===i?{...x,weight:Number(e.target.value)}:x))}/><small>%</small></label><textarea aria-label={r.name+'评分说明'} rows={2} maxLength={1000} placeholder="该维度的具体评分要求" value={r.criteria} disabled={readonly} onChange={e=>change('rubric',form.rubric.map((x,j)=>j===i?{...x,criteria:e.target.value}:x))}/></div>)}</div>
          <details className="task-roster" open={!locked}><summary>班级名单（{rosterText.trim()?rosterText.trim().split(/\r?\n/).length:0}行） · 用于统计应交与未交</summary><p className="muted">每行“学号 姓名”，支持逗号、Tab、空格分隔。可导入UTF-8 CSV/TXT。名单只在本地保存，不发送模型；不填写时不计算应交与未交。</p>{!locked&&<label className="file-import"><Upload size={16}/>导入班级名单<input aria-label="导入班级名单" type="file" accept=".csv,.txt" disabled={disabled} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>1024*1024)throw Error('名单文件请控制在1MB以内');const value=await file.text();parseRoster(value);setRosterText(value);setDirty(true);setReviewed(false);}catch(err){setError((err as Error).message);}}}/></label>}<textarea aria-label="班级学生名单" rows={5} value={rosterText} disabled={readonly} onChange={e=>{setRosterText(e.target.value);setDirty(true);setReviewed(false);}} placeholder={'2026001 张三\n2026002 李四'}/></details>
          {!!sources.length&&<div className="task-sources"><h3>课程资料依据</h3>{sources.map(s=><p key={s.id}>{s.title} · {s.source.file} · {s.source.unit||'页'} {s.source.page}</p>)}</div>}
          {error&&<div className="error" role="alert">{error}</div>}
          {!locked?<><label className="consent"><input aria-label="作业发布审核确认" type="checkbox" disabled={disabled} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>已核对作业、课程、班级名单和评分量规，确认发布供本班使用。发布后内容锁定。</span></label><div className="task-actions"><button className="subtle" disabled={disabled||!ready} onClick={()=>void save()}><Save size={16}/>保存草稿</button><button className="primary" disabled={disabled||!ready||!form.instructions.trim()||!reviewed} onClick={()=>void publish()}><Send size={16}/>确认发布</button></div></>:<div className="task-actions"><button className="subtle" onClick={()=>window.location.assign('/api/assignment-tasks/'+current!.id+'/export/docx')}><Download size={16}/>导出Word任务书</button><button className="primary" disabled={disabled||current?.status==='closed'} onClick={()=>onGrade(current!.id,[])}><Upload size={16}/>收交学生作业</button>{current?.status==='published'?<button className="text-button" disabled={disabled} onClick={()=>void close()}>结束收交</button>:<button className="text-button" disabled={disabled} onClick={()=>void publish()}>重新开放收交</button>}</div>}
        </section>
        {locked&&current&&<section className="glass task-progress-panel">
          <div className="task-editor-heading"><div><h2>收交与批改进度</h2><small className="muted">截止时间：{deadlineLabel(current.deadline)}</small></div><button className="subtle" disabled={disabled} onClick={()=>void reload().catch(e=>setError(e.message))}>刷新进度</button></div>
          <div className="task-kpis">{[['应交',current.progress.expected??'未设名单'],['已交',current.progress.submitted],['未交',current.progress.expected===null?'—':current.progress.missing.length],['已复核',current.progress.reviewed],['待复核',current.progress.pending_review]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          {current.progress.expected!==null&&<div className="task-completion"><progress max={current.progress.expected} value={current.progress.submitted}/><span>收交完成 {Math.round(current.progress.submitted/current.progress.expected*100)}%</span></div>}
          <div className="task-selection"><span>已选 {checked.length} / 30份 · 教师上传时间用于标记逾期</span><button className="subtle" disabled={!current.progress.submissions.length} onClick={()=>setChecked(current.progress.submissions.filter(s=>s.status!=='reviewed').slice(0,30).map(s=>s.id))}>选择待批改</button><button className="primary" disabled={!checked.length||disabled} onClick={()=>onGrade(current.id,checked)}><ArrowRight size={16}/>进入批改</button></div>
          <div className="table-scroll"><table><thead><tr><th>选择</th><th>学号 / 姓名</th><th>收交状态</th><th>批改状态</th><th>已复核分数</th></tr></thead><tbody>{current.progress.submissions.map(s=><tr key={s.id}><td><input type="checkbox" aria-label={'选择作业'+s.student_id} checked={checked.includes(s.id)} disabled={disabled||(!checked.includes(s.id)&&checked.length>=30)} onChange={e=>setChecked(xs=>e.target.checked?[...xs,s.id]:xs.filter(id=>id!==s.id))}/></td><td>{s.student_id}<small>{s.student_name}</small></td><td>{s.late?'逾期收交':'已交'}<small>第{s.revision}版</small></td><td>{s.status==='reviewed'?'教师已复核':s.status==='draft'?'AI初稿待复核':'待批改'}</td><td>{s.score??'—'}</td></tr>)}</tbody></table>{!current.progress.submissions.length&&<p className="muted task-empty">尚未收交作业，请点击“收交学生作业”。</p>}</div>
          {!!current.progress.missing.length&&<details className="task-roster"><summary>未交学生 · {current.progress.missing.length}人</summary><p>{current.progress.missing.map(s=>`${s.student_id} ${s.student_name}`).join('；')}</p></details>}
        </section>}
      </div>
    </div>
    {locked&&current&&<ReviewDrawer open={!!detailTab} onClose={()=>setDetailTab(null)} title={current.title} subtitle={current.class_name+' · '+current.term} initialTab={detailTab||'instructions'} tabs={[
      {id:'instructions',label:'任务要求',content:<><h3>教学目标</h3><p>{current.goal||'未填写'}</p><h3>作业内容</h3><p>{current.instructions}</p><h3>提交要求</h3><p>{current.submission_requirements}</p></>},
      {id:'rubric',label:'评价标准',content:<><h3>五项量规 · 合计100%</h3>{current.rubric.map(r=><article className="grade-dimension" key={r.name}><span>{r.name}<small>{r.weight}%</small></span><p>{r.criteria||'按课程要求评价。'}</p></article>)}</>},
      {id:'sources',label:'课程依据',content:current.sources.length?current.sources.map(s=><article className="review-source-card" key={s.id}><b>{s.title}</b><small>{s.source.file} · {s.source.unit||'页'} {s.source.page}</small></article>):<p>本任务未指定课程资料引用，由教师审核作业适切性。</p>},
      {id:'roster',label:'班级名单',content:<><h3>班级名单 · {current.roster.length}人</h3>{current.roster.length?<p>{current.roster.map(s=>s.student_id+' '+s.student_name).join('\n')}</p>:<p>未设置名单，不推测应交与未交。</p>}<p className="review-help">名单只在教师工作空间保存，不发送模型，不出现在学生任务书中。</p></>}
    ]}/>}
  </div>;
}
