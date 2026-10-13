import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {api} from './api';
import {ReviewOverview} from './ReviewOverview';
import {ReviewDrawer} from './ReviewDrawer';
import type {User,Knowledge} from './types';
type RecordItem={id:string;batch_id:string;title:string;created:number|null;reviewed:boolean;superseded?:boolean;total:number|null;teacher_comment:string;comments:{quote:string;comment:string}[];suggestion:string;dimensions:{name:string;score:number;reason:string}[];model?:string;evidence_scope?:string;sources?:Pick<Knowledge,'id'|'title'|'source'>[]};
type Student={student_id:string;student_name:string;course:string;term:string;names:string[];course_score:number|null;reviewed_count:number;assignment_count:number;trend:number|null;abilities:{name:string;score:number;count:number}[];records:RecordItem[];revisions:{id:string;created:number;previous:{total:number;reviewed:boolean}[];current:{total:number;reviewed:boolean}[]}[]};
const label=(record:RecordItem)=>record.superseded?'历史版本 · 不计入过程成绩':record.reviewed?'教师已复核':'AI初稿 · 不计入过程成绩';
export function StudentsPage({user}:{user:User}){
  const [students,setStudents]=useState<Student[]>([]),[teachers,setTeachers]=useState<{username:string;display_name:string}[]>([]),[owner,setOwner]=useState(''),[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[course,setCourse]=useState(''),[error,setError]=useState(''),[unidentified,setUnidentified]=useState(0),[reviewId,setReviewId]=useState<string|null>(null),[tab,setTab]=useState('rubric'),[dimension,setDimension]=useState(0);
  useEffect(()=>{if(user.role==='admin')void api<{username:string;display_name:string}[]>('/admin/teachers').then(xs=>{setTeachers(xs);setOwner(xs[0]?.username||'');}).catch(e=>setError(e.message));},[]);
  async function load(){if(user.role==='admin'&&!owner)return;try{setError('');const x=await api<{students:Student[];unidentified:number}>('/students'+(user.role==='admin'?'?teacher='+encodeURIComponent(owner):''));setStudents(x.students);setUnidentified(x.unidentified);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{setSelected('');setCourse('');setReviewId(null);void load();},[owner]);
  const key=(student:Student)=>JSON.stringify([student.student_id,student.course,student.term]),filtered=students.filter(s=>(s.student_id+' '+s.student_name).includes(query)&&(!course||s.course===course)),current=filtered.find(s=>key(s)===selected)||filtered[0],record=current?.records.find(r=>r.id===reviewId);
  const ordered=current?[...current.records].reverse():[],latest=ordered.find(r=>r.reviewed&&!r.superseded)||ordered[0];
  function show(recordId:string,initial='rubric'){setTab(initial);setReviewId(recordId);}
  function exportReport(format:string){if(!current)return;const params=new URLSearchParams({course:current.course,term:current.term,...(user.role==='admin'?{teacher:owner}:{})});window.location.assign('/api/students/'+encodeURIComponent(current.student_id)+'/report/'+format+'?'+params);}
  const recordCards=(rows:RecordItem[])=>rows.map(r=><article className="review-record-card" key={r.id}><div><h4>{r.title}</h4><small>{label(r)} · {r.created?new Date(r.created).toLocaleDateString():'日期未记录'}</small></div><b>{r.total??'—'}</b><button className="subtle" onClick={()=>show(r.id)}>查看评价<ArrowUpRight size={14}/></button></article>);
  return <div className="feature-page"><div className="students-heading"><div><h1>学生成绩与能力档案</h1><p className="muted">成绩摘要在眼前，完整评价点击查看。</p></div><button className="subtle" onClick={()=>void load()}>刷新档案</button></div>
    {user.role==='admin'&&<label>查看教师<select aria-label="查看教师" value={owner} onChange={e=>setOwner(e.target.value)}>{teachers.map(t=><option key={t.username} value={t.username}>{t.display_name||t.username}（{t.username}）</option>)}</select></label>}
    {error&&<p className="error" role="alert">{error}</p>}{unidentified>0&&<p className="notice">{unidentified}份作业未填写学号，请先在批改页核对。</p>}
    <div className="student-layout"><aside className="glass student-list"><input aria-label="搜索学生" placeholder="搜索学号或姓名" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="筛选课程" value={course} onChange={e=>setCourse(e.target.value)}><option value="">全部课程</option>{[...new Set(students.map(s=>s.course))].map(c=><option key={c}>{c}</option>)}</select>{filtered.map(s=><button className={current&&key(current)===key(s)?'selected':''} key={key(s)} onClick={()=>{setSelected(key(s));setReviewId(null);setDimension(0);}}><b>{s.student_name||'姓名待核对'}<span>{s.course_score??'—'}</span></b><small>{s.student_id} · {s.course}</small><small>{s.reviewed_count}/{s.assignment_count}份已复核 · {s.term||'学期待填写'}</small></button>)}{!filtered.length&&<p className="muted">完成教师复核后显示学生档案。</p>}</aside>
      <section className="glass student-detail">{current?<><div className="result-heading"><div><h2>{current.student_name||'姓名待核对'} · {current.student_id}</h2><p className="muted">{current.course} · {current.term||'学期未填写'}</p></div><div className="export-actions"><button className="subtle" disabled={!current.reviewed_count} onClick={()=>exportReport('docx')}>导出能力报告Word</button><button className="subtle" disabled={!current.reviewed_count} onClick={()=>exportReport('csv')}>导出成绩CSV</button></div></div>
        {current.names.length>1&&<div className="notice">同一学号曾出现不同姓名，请核对：{current.names.join('、')}</div>}
        <div className="review-record-list"><ReviewOverview title="学迹 · 课程能力星环" score={current.course_score} dimensions={current.abilities.map(a=>({name:a.name,score:a.score}))} status={current.reviewed_count+'份已复核作业 · 等权平均'} active={dimension} paused={!!record} onOpen={()=>{if(latest)show(latest.id,'abilities');}} onDimension={i=>{setDimension(i);if(latest)show(latest.id,'abilities');}}/>
          <div className="review-mini-summary"><span>已复核 {current.reviewed_count}/{current.assignment_count}份</span><span>首末次分差：{current.trend===null?'暂不比较':(current.trend>=0?'+':'')+current.trend+'分'}</span>{latest&&<button className="text-button" onClick={()=>show(latest.id,'policy')}>查看计算口径</button>}</div>
          <h3>最近作业评价</h3>{recordCards(ordered.slice(0,5))}{ordered.length>5&&latest&&<button className="subtle" onClick={()=>show(latest.id,'records')}>查看全部{ordered.length}条记录</button>}
          {!!current.revisions.length&&latest&&<button className="text-button" onClick={()=>show(latest.id,'history')}>评分修订 · {current.revisions.length}次</button>}
        </div>
      </>:<div className="large-empty"><h2>让每一份作业形成成长档案</h2><p>填写学号、完成教师复核后生成。</p></div>}</section>
    </div>
    {current&&record&&<ReviewDrawer open={true} onClose={()=>setReviewId(null)} title={current.student_name+' · 成绩与评价'} subtitle={current.student_id+' · '+current.course+' · '+current.term} initialTab={tab} tabs={[
      {id:'abilities',label:'课程能力',content:<><h3>课程分项平均 · {current.reviewed_count}份已复核依据</h3>{current.abilities.map(a=><article className="grade-dimension" key={a.name}><span>{a.name}<small>{a.score}/100</small></span><p>来自{a.count}份已复核作业的分项平均，不等同于本次单份作业的得分。</p></article>)}</>},
      {id:'rubric',label:'分项评价',content:<><h3>{record.title} · {record.total??'暂无'}分</h3>{record.dimensions.map(d=><article className="grade-dimension" key={d.name}><span>{d.name}<small>{d.score}/100</small></span><p>{d.reason}</p></article>)}</>},
      {id:'evidence',label:'原文证据',content:<><h3>原文批注</h3>{record.comments.length?record.comments.map((c,i)=><article className="annotation" key={i}><blockquote>{c.quote}</blockquote><p>{c.comment}</p></article>):<p>此记录没有原文批注，不补造依据。</p>}<h3>改进建议</h3><p>{record.suggestion}</p></>},
      {id:'teacher',label:'教师评价',content:<><h3>教师综合评价</h3><p>{record.teacher_comment||'此记录尚未填写教师综合评价。'}</p><p className="review-help">正式成绩以教师复核为准。修改请回到对应批改批次进行，历史记录会保留。</p></>},
      {id:'sources',label:'参考依据',content:<><h3>评价范围与参考资料</h3><p>{record.evidence_scope==='teacher_reviewed_shots'?'已提供教师复核镜头快照。':'仅据脱敏正文评价，未独立核验画面或声音。'}</p>{record.model&&<p>初稿模型：{record.model}</p>}{record.sources?.length?record.sources.map(k=><article className="review-source-card" key={k.id}><b>{k.title}</b><small>{k.source.file} · {k.source.unit||'页'} {k.source.page}</small></article>):<p>历史记录未保存资料快照，不补造引用。</p>}</>},
      {id:'policy',label:'计算口径',content:<><h3>课程过程成绩口径</h3><p>仅纳入已复核的作业总分，按作业等权平均。同一关联任务只计最新已复核版本，历史评价保留。AI初稿不计入。该过程分数不等同于学校认定的期末总评，也不能单独证明教学带来了能力提升。</p><p>本学期已复核：{current.reviewed_count}份；课程过程成绩：{current.course_score??'暂无'}。</p></>},
      {id:'records',label:'全部记录',content:recordCards(ordered)},
      {id:'history',label:'修订记录',content:<><h3>评分修订记录</h3>{current.revisions.length?current.revisions.map(r=><p key={r.id}>{new Date(r.created).toLocaleString()}：{r.previous.map(v=>v.total+'分').join('、')} → {r.current.map(v=>v.total+'分').join('、')}</p>):<p>尚无评分修订记录。</p>}</>}
    ]}/>}
  </div>;
}
