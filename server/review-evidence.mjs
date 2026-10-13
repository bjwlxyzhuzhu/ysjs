export function reviewedGradeItems(grades){
  const selected=new Map();
  for(const grade of [...grades].sort((a,b)=>(a.created||0)-(b.created||0))){
    if(grade.reviewed!==true)continue;
    for(const [index,item] of (grade.items||[]).entries()){
      if(!Number.isFinite(item.total)||item.total<0||item.total>100||!Array.isArray(item.dimensions)||!item.dimensions.length||item.dimensions.some(d=>!Number.isFinite(d.score)||d.score<0||d.score>100))continue;
      const key=grade.assignment_task_id&&(item.student_id||item.submission_id)?JSON.stringify([grade.assignment_task_id,item.student_id||item.submission_id]):JSON.stringify([grade.id,index]);
      const version=item.submission_revision||0,previous=selected.get(key);
      if(!previous||version>=previous.version)selected.set(key,{item,version});
    }
  }
  return [...selected.values()].map(x=>x.item);
}
export function gradeMetricSummary(grades){
  const official=reviewedGradeItems(grades);
  return {reviewed_homework:official.length,draft_homework:grades.filter(g=>!g.reviewed).reduce((n,g)=>n+(g.items?.length||0),0),mean_score:official.length?Math.round(official.reduce((n,i)=>n+i.total,0)/official.length*10)/10:null,distribution:[0,60,70,80,90].map((lower,i,limits)=>({lower,count:official.filter(x=>x.total>=lower&&x.total<(limits[i+1]||101)).length}))};
}
export function reviewFeedback(item){
  return [item.teacher_comment?'教师评价：'+item.teacher_comment:'',...(item.comments||[]).map(c=>'原文批注：'+c.comment),item.suggestion?'改进建议：'+item.suggestion:''].filter(Boolean).join('；');
}
export function gradeReviewText(batch){
  return ['# 作业反馈 · 教师已复核',`课程：${batch.course||'未填写'}；学期：${batch.term||'未填写'}；作业：${batch.assignment_title||'作业批次'}`,batch.class_name?'班级：'+batch.class_name:'',batch.model?'初稿模型：'+batch.model:'',...batch.items.map(item=>[
    `${item.student_id||item.id} ${item.student_name||''} · ${item.total}分`,
    ...item.dimensions.map(d=>`${d.name} ${d.score}：${d.reason}`),
    '教师综合评价：'+(item.teacher_comment||'未填写'),
    ...(item.comments||[]).map(c=>'原文：'+c.quote+'\n批注：'+c.comment),
    '建议：'+item.suggestion,
    item.evidence_scope==='teacher_reviewed_shots'?'验证范围：脱敏正文与教师复核镜头快照':'验证范围：脱敏正文；未据此独立验证实际画面或声音',
    ...(item.sources||[]).map(k=>`提供的参考资料：${k.title} · ${k.source.file} · ${k.source.unit||'页'} ${k.source.page}`)
  ].join('\n'))].filter(Boolean).join('\n\n');
}
