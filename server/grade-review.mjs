import {randomUUID} from 'node:crypto';
export function registerGradeReview(app,{teacher,get,save,db}){
 app.patch('/api/homework/:id',teacher,(req,res)=>{
  const x=get(req.params.id,req.user.username);if(!Array.isArray(x.items)||!Array.isArray(x.rubric))return res.status(404).json({error:'批改记录不存在'});const previous=structuredClone(x);
  if(req.body.scores!==undefined){if(!Array.isArray(req.body.scores)||req.body.scores.length!==x.items.length)return res.status(400).json({error:'分数结构无效'});for(const [i,scores] of req.body.scores.entries()){if(!Array.isArray(scores)||scores.length!==5||scores.some(v=>!Number.isFinite(v)||v<0||v>100))return res.status(400).json({error:'分数应在0–100之间'});x.items[i].dimensions.forEach((d,j)=>d.score=scores[j]);x.items[i].total=Math.round(scores.reduce((n,s,j)=>n+s*x.rubric[j].weight/100,0)*10)/10;}}
  if(req.body.teacher_comments!==undefined){const comments=req.body.teacher_comments;if(!Array.isArray(comments)||comments.length!==x.items.length||comments.some(c=>typeof c!=='string'||c.length>4000))return res.status(400).json({error:'教师评价应与作业逐一对应，每条不超过4000字'});comments.forEach((c,i)=>x.items[i].teacher_comment=c.trim());}
  if(req.body.identities!==undefined){const identities=req.body.identities;if(!Array.isArray(identities)||identities.length!==x.items.length||identities.some(it=>!it||typeof it.student_id!=='string'||typeof it.student_name!=='string'||it.student_id.length>200||it.student_name.length>200))return res.status(400).json({error:'学号姓名需与作业逐一对应，且不超过200字'});identities.forEach((it,i)=>{x.items[i].student_id=it.student_id.trim();x.items[i].student_name=it.student_name.trim();});}
  x.reviewed=req.body.reviewed===true;x.common=x.rubric.map((w,i)=>({name:w.name,count:x.items.filter(it=>it.dimensions[i].score<70).length,total:x.items.length}));
  if(JSON.stringify(previous)!==JSON.stringify(x)){const created=Date.now();x.reviewed_at=x.reviewed?created:null;db.exec('BEGIN');try{save('grade_revision',{id:randomUUID(),batch_id:x.id,created,previous,current:structuredClone(x)},req.user.username);save('grade',x,req.user.username);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
  res.json(x);
 });
}
