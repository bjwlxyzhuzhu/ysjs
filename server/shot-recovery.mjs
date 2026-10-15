// Time overlap alone is not sufficient: adjacent shots and repeated scenes at
// different times remain distinct. Only near-identical time intervals merge.
export function sameRange(a,b){
 const overlap=Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start));
 const union=Math.max(a.end,b.end)-Math.min(a.start,b.start);
 return Math.abs(a.start-b.start)<.01&&Math.abs(a.end-b.end)<.01 || union>0&&overlap/union>.92;
}
export function uniqueShots(shots){
 const rank=s=>(s.status==='teacher_reviewed'?100:0)+(s.changed_fields?.length?50:0)+(s.status==='ai_draft'?10:0);
 const result=[];
 for(const s of [...shots].sort((a,b)=>rank(b)-rank(a))){if(!result.some(x=>x.id&&x.id===s.id||sameRange(x,s)))result.push(s);}
 return result.sort((a,b)=>a.start-b.start).map((s,i)=>({...s,index:i+1}));
}
export function checkpoint(clip,label){
 clip.shot_history=[...(clip.shot_history||[]),{label,created:Date.now(),shots:structuredClone(clip.shots),selection:structuredClone(clip.selection||[]),manual_selection:!!clip.manual_selection,reselect:!!clip.reselect,excluded_ranges:structuredClone(clip.excluded_ranges||[])}].slice(-10);
}
export function restoreCheckpoint(clip){
 const last=clip.shot_history?.pop();if(!last)throw Object.assign(Error('没有可撤销的分镜操作'),{status:400});
 for(const key of ['shots','selection','manual_selection','reselect','excluded_ranges'])clip[key]=last[key];
 return last.label;
}
export function teacherEvidence(shots,catalogue){
 const sources=[...catalogue];
 const normalized=shots.map(s=>{
  const ids=(s.knowledge_ids||[]).filter(id=>catalogue.some(k=>k.id===id));
  if(!ids.length&&s.teaching_point?.trim()){
   const id='teacher.'+s.id;
   sources.push({id,title:'教师教学要点 · 镜头 '+s.index,summary:s.teaching_point,excerpt:s.teaching_point,source:{file:'教师镜头标注',page:s.index,unit:'条'},status:'教师已复核'});ids.push(id);
  }
  return {...s,knowledge_ids:ids};
 });
 return {shots:normalized,catalogue:sources};
}
