import type { Clip } from './types';
export function AnalysisProgress({clip}:{clip:Clip}){
 const p=clip.progress,total=p?.total??(clip.status==='processing'?0:clip.shots.length),done=Math.min(p?.completed??clip.shots.filter(s=>s.status!=='manual_required').length,total);
 const pct=total?Math.round(done/total*100):undefined;
 return <section className="analysis-progress" aria-label="拉片分析进度"><div><strong>{clip.status==='processing'?'AI分析进行中':clip.status==='error'?'分析已暂停':'分析进度'}</strong><span>{total?`${done}/${total} 个片段${p?.phase==='frames'?'已抽帧':'已处理'} · ${pct}%`:clip.status==='processing'?'正在准备或筛选，完成数量尚未确定':'尚无可统计的片段'}</span></div><div className={'progress-track '+(pct===undefined&&clip.status==='processing'?'indeterminate':'')} role="progressbar" aria-label="已处理片段进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{width:pct===undefined?(clip.status==='processing'?'30%':'0%'):pct+'%'}}/></div>{p?.success!==undefined&&<p>有效标注 {p.success} · 失败 {p.failed||0} · 待处理 {p.pending||0}（已处理不等于成功）</p>}<p>{clip.stage||'等待开始'}{clip.status==='processing'?' · 当前模型请求可能需要数分钟；百分比按当前阶段已处理片段计算':''}</p></section>;
}
