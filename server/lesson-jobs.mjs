import { randomUUID } from 'node:crypto';
export function createLessonJobs({list,save,get,generate,jobType='lesson_job',resultKey='lesson',queuedStage='已进入备课生成队列',runningStage='模型正在组织课件大纲、讨论题与导入设计'}){
 function start(owner,clip,goal){
  const running=list(jobType,owner).find(j=>j.clip_id===clip.id&&['queued','running'].includes(j.status));
  if(running)return running;
  const job={id:randomUUID(),clip_id:clip.id,goal,status:'queued',stage:queuedStage,created:Date.now(),...(jobType==='lesson_job'?{progress:5}:{})};save(jobType,job,owner);
  void (async()=>{try{
   job.status='running';job.stage=runningStage;if(jobType==='lesson_job')job.progress=15;save(jobType,job,owner);
   const update=patch=>{Object.assign(job,patch);save(jobType,job,owner);};
   const result=await generate(clip,goal,owner,update);
   job.status='completed';job.stage='处理完成，请教师复核';job[resultKey+'_id']=result.id;if(jobType==='lesson_job')job.progress=100;
  }catch(e){job.status='failed';job.stage='处理失败';job.error=e.message;}finally{job.finished=Date.now();save(jobType,job,owner);}})();
  return job;
 }
 return {start,status:(id,owner)=>{const j=get(id,owner);if(!j.clip_id||!['queued','running','completed','failed'].includes(j.status))throw Object.assign(Error('未找到生成任务'),{status:404});return {...j,[resultKey]:j.status==='completed'?get(j[resultKey+'_id'],owner):undefined};}};
}
