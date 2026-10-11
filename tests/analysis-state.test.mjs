import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasVisualObservation,analysisOutcome} from '../server/analysis-state.mjs';
test('全无法判断的空结果不作为有效AI标注；录屏的实际布局描述可用',()=>{
 assert.equal(hasVisualObservation({composition:'无法判断',lighting:'无法判断',function:'无法判断',confidence:0}),false);
 assert.equal(hasVisualObservation({composition:'深蓝色页面中央为白色标题，两侧分布人物插画',function:'品牌介绍页面；仅据静帧不能判断声音'}),true);
});
test('图像能力关闭时不将仅抽帧的0/9记录标记分析完成',()=>{
 const result=analysisOutcome({shots:Array.from({length:9},()=>({status:'manual_required'}))},false);
 assert.equal(result.analysis_complete,false);assert.equal(result.progress.completed,0);assert.match(result.stage,/等待图像能力/);assert.ok(result.error);
});
test('失败和待处理分开，全部尝试失败也不等于分析成功',()=>{
 const result=analysisOutcome({shots:[{status:'ai_draft'},{status:'manual_required',analysis_state:'failed'},{status:'manual_required'}]},true);
 assert.equal(result.status,'error');assert.equal(result.analysis_complete,false);assert.deepEqual(result.progress,{phase:'paused',completed:2,total:3,success:1,failed:1,pending:1});
 assert.equal(analysisOutcome({shots:[{status:'manual_required',analysis_state:'failed'}]},true).analysis_complete,false);
});
test('全部有效标注才完成，教师复核有独立状态',()=>{
 assert.equal(analysisOutcome({shots:[{status:'ai_draft'}]},true).analysis_complete,true);
 assert.equal(analysisOutcome({shots:[{status:'teacher_reviewed'}]},false).status,'reviewed');
});
