export function hasVisualObservation(raw){
 return ['composition','lighting','function','narrative_function'].some(k=>typeof raw?.[k]==='string'&&raw[k].trim().length>=4&&!/^(无法判断|未知|不确定|unknown|N\/A|无|暂无)([。.!！]*)$/i.test(raw[k].trim()));
}
export function analysisOutcome(clip,vision){
 const total=clip.shots.length,success=clip.shots.filter(s=>s.status!=='manual_required').length;
 const failed=clip.shots.filter(s=>s.status==='manual_required'&&s.analysis_state==='failed').length;
 const pending=total-success-failed,complete=total>0&&success===total;
 const error=complete?null:!vision?'图像能力尚未启用，本次仅提取了关键帧。请在模型设置中验证图像能力，再恢复分析。':`标注未完成：成功 ${success}、失败 ${failed}、待处理 ${pending}。请恢复未完成分析；已有有效结果与教师修改会保留。`;
 return {status:complete?(clip.shots.every(s=>s.status==='teacher_reviewed')?'reviewed':'review'):(vision?'error':'review'),analysis_complete:complete,error,stage:complete?'教学精选分析完成，请逐镜复核':!vision?'关键帧已就绪，等待图像能力验证':'AI标注未完成，可恢复失败与待处理片段',progress:{phase:complete?'done':'paused',completed:success+failed,total,success,failed,pending}};
}
