import type {LessonJob} from './types';
export function LessonProgress({job,busy,elapsed}:{job:LessonJob|null;busy:boolean;elapsed:number}){
 const running=busy||job?.status==='queued'||job?.status==='running';
 const percent=job?.status==='completed'?100:Math.min(99,Math.max(0,job?.progress??(job?.status==='running'?35:5)));
 return <section className="analysis-progress" aria-label="备课生成进度"><div><strong>{job?.status==='failed'?'生成已暂停':job?.status==='completed'?'备课材料已生成':'正在生成备课材料'}</strong><span>阶段进度 · {percent}%</span></div><div className={'progress-track '+(running?'waiting':'')} role="progressbar" aria-label="备课阶段进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:percent+'%'}}/></div><p>{job?.stage||'正在提交任务'}</p>{running&&<p>已等待 {elapsed} 秒 · 百分比按处理阶段计算，模型等待期间保留动效；刷新后可找回进度。</p>}{job?.status==='completed'&&<p>结果已校验并保存，请教师复核。</p>}</section>;
}
