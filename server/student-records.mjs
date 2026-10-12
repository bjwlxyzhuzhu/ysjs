import {Document,Packer,Paragraph,TextRun} from 'docx';
export function courseMetadata(body={}){
 const out={};for(const [key,fallback] of [['course','影视鉴赏'],['term',''],['assignment_title','']]){const value=body[key]??fallback;if(typeof value!=='string'||value.length>120)throw Object.assign(Error('课程、学期和作业名称需为不超过120字的文本'),{status:400});out[key]=value.trim()||fallback;}return out;
}
const mean=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*10)/10:null;
export function studentReports(grades,revisions=[]){
 const groups=new Map();let unidentified=0;
 for(const grade of grades){const meta=courseMetadata(grade);for(const [index,item] of grade.items.entries()){
  const id=item.student_id?.trim();if(!id){unidentified++;continue;}
  const key=JSON.stringify([id,meta.course,meta.term]);if(!groups.has(key))groups.set(key,{student_id:id,student_name:'',course:meta.course,term:meta.term,names:[],records:[],revisions:[]});const group=groups.get(key);
  if(item.student_name&&!group.names.includes(item.student_name))group.names.push(item.student_name);
  const valid=Number.isFinite(item.total)&&item.dimensions?.every(d=>Number.isFinite(d.score));
  group.records.push({id:grade.id+':'+index,batch_id:grade.id,item_id:item.id,assignment_task_id:grade.assignment_task_id||null,submission_revision:item.submission_revision||0,created:grade.created||null,reviewed_at:grade.reviewed_at||null,title:meta.assignment_title||'作业批次',reviewed:grade.reviewed===true&&valid,total:valid?item.total:null,dimensions:item.dimensions||[],comments:item.comments||[],suggestion:item.suggestion||'',teacher_comment:item.teacher_comment||'',student_name:item.student_name||'',filename:item.filename||''});
 }}
 for(const group of groups.values()){
  group.records.sort((a,b)=>(a.created||0)-(b.created||0));group.student_name=[...group.records].reverse().find(r=>r.student_name)?.student_name||'';
  const latest=new Map();for(const r of group.records.filter(r=>r.reviewed&&r.total!==null&&r.assignment_task_id)){const old=latest.get(r.assignment_task_id);if(!old||r.submission_revision>=old.submission_revision)latest.set(r.assignment_task_id,r);}
  for(const r of group.records)r.superseded=!!r.assignment_task_id&&r.reviewed&&latest.get(r.assignment_task_id)!==r;
  const official=group.records.filter(r=>r.reviewed&&r.total!==null&&!r.superseded);group.reviewed_count=official.length;group.assignment_count=new Set(group.records.map(r=>r.assignment_task_id||r.id)).size;group.course_score=mean(official.map(r=>r.total));
  group.abilities=[...new Set(official.flatMap(r=>r.dimensions.map(d=>d.name)))].map(name=>({name,score:mean(official.flatMap(r=>r.dimensions.filter(d=>d.name===name).map(d=>d.score))),count:official.filter(r=>r.dimensions.some(d=>d.name===name)).length}));
  group.trend=official.length>=2?Math.round((official.at(-1).total-official[0].total)*10)/10:null;
  group.revisions=revisions.filter(rev=>rev.current?.items?.some(it=>it.student_id?.trim()===group.student_id)&&courseMetadata(rev.current).course===group.course&&courseMetadata(rev.current).term===group.term).sort((a,b)=>a.created-b.created).map(rev=>({id:rev.id,created:rev.created,batch_id:rev.batch_id,previous:rev.previous.items.filter((it,i)=>rev.current.items[i]?.student_id?.trim()===group.student_id).map(it=>({total:it.total,reviewed:rev.previous.reviewed,teacher_comment:it.teacher_comment||''})),current:rev.current.items.filter(it=>it.student_id?.trim()===group.student_id).map(it=>({total:it.total,reviewed:rev.current.reviewed,teacher_comment:it.teacher_comment||''}))}));
 }
 return {students:[...groups.values()].sort((a,b)=>a.student_id.localeCompare(b.student_id)),unidentified};
}
export function abilityReportText(report){
 return ['学生课程能力报告',`学号：${report.student_id}    姓名：${report.student_name||'未填写'}`,`课程：${report.course}    学期：${report.term||'未填写'}`,`已复核作业：${report.reviewed_count}/${report.assignment_count}`,`课程过程成绩：${report.course_score??'暂无'} / 100`, '计算口径：已复核作业总分等权平均；关联同一任务仅计最新已复核版本，历史评价保留。属于过程评价，不是学校认定的期末总评；待复核AI初稿不计入。',`首末次作业分差：${report.trend===null?'作业数不足，暂不比较':report.trend+'分'}`,'分项能力表现（已复核作业分项分数的算术平均）',...report.abilities.map(a=>`${a.name}：${a.score} / 100（${a.count}份依据）`),'每次作业成绩与评价',...report.records.map(r=>`${r.created?new Date(r.created).toLocaleString():'日期未记录'} · ${r.title} · ${r.superseded?'历史版本（不计入过程成绩）':r.reviewed?'教师已复核':'AI初稿待复核'}\n总分：${r.total??'暂无'}\n${r.dimensions.map(d=>d.name+'：'+d.score+'，'+d.reason).join('\n')}\n教师评价：${r.teacher_comment||'尚未填写'}\n批注：${r.comments.map(c=>c.quote+' → '+c.comment).join('；')}\n改进建议：${r.suggestion}`),'评分修订记录',...report.revisions.map(r=>`${new Date(r.created).toLocaleString()}：${r.previous.map(x=>x.total+'（'+(x.reviewed?'已复核':'初稿')+'）').join('、')} → ${r.current.map(x=>x.total+'（'+(x.reviewed?'已复核':'初稿')+'）').join('、')}`)].join('\n\n');
}
const csvCell=x=>'"'+String(x??'').replace(/"/g,'""').replace(/^\s*[=+@-]/,"' $&")+'"';
export function registerStudents(app,{db,list}){
 function owner(req){if(!['teacher','admin'].includes(req.user.role))throw Object.assign(Error('仅教师与管理员可查看成绩档案'),{status:403});if(req.user.role==='teacher'){if(req.query.teacher&&req.query.teacher!==req.user.username)throw Object.assign(Error('无权查看其他教师的学生成绩'),{status:403});return req.user.username;}const name=String(req.query.teacher||'');if(!db.prepare("SELECT username FROM users WHERE username=? AND role='teacher'").get(name))throw Object.assign(Error('请选择教师账号'),{status:400});return name;}
 const reports=req=>{const name=owner(req);return studentReports(list('grade',name),list('grade_revision',name));};
 app.get('/api/students',(req,res)=>res.json(reports(req)));
 function find(req){const report=reports(req).students.find(r=>r.student_id===req.params.id&&r.course===String(req.query.course||'影视鉴赏')&&r.term===String(req.query.term||''));if(!report)throw Object.assign(Error('该课程内没有此学生的作业记录'),{status:404});return report;}
 app.get('/api/students/:id',(req,res)=>res.json(find(req)));
 app.get('/api/students/:id/report/:format',async(req,res)=>{
  const report=find(req);if(!report.reviewed_count)return res.status(409).json({error:'请先复核该学生至少一份作业再导出能力报告'});
  if(req.params.format==='csv'){const rows=[['学号','姓名','课程','学期','作业名称','日期','作业分数','课程过程成绩','状态','教师评价','批改建议'],...report.records.map(r=>[report.student_id,report.student_name,report.course,report.term,r.title,r.created?new Date(r.created).toISOString():'',r.total,report.course_score,r.superseded?'历史版本（不计入过程成绩）':r.reviewed?'教师已复核':'AI初稿待复核',r.teacher_comment,r.comments.map(c=>c.comment).join('；')+'；'+r.suggestion])];res.setHeader('Content-Disposition','attachment; filename="student-course-grades.csv"');return res.type('text/csv').send('\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'));}
  if(req.params.format!=='docx')return res.status(400).json({error:'报告支持Word与CSV格式'});
  const children=abilityReportText(report).split('\n').map((text,i)=>new Paragraph({spacing:{after:120},children:[new TextRun({text,font:'Microsoft YaHei',size:i===0?32:22,bold:i===0})]}));const buffer=await Packer.toBuffer(new Document({sections:[{children}]}));res.setHeader('Content-Disposition','attachment; filename="student-ability-report.docx"');res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);
 });
}
