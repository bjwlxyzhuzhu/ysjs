import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviewedGradeItems,gradeMetricSummary,reviewFeedback,gradeReviewText} from '../server/review-evidence.mjs';
const item=(score,version=1)=>({id:'item',student_id:'001',student_name:'虚构学生',submission_revision:version,total:score,dimensions:[{name:'证据分析',score,reason:'依据原文'}],comments:[{quote:'原文证据',comment:'补充具体细节'}],suggestion:'核对论证',teacher_comment:'教师评价应进入导出',evidence_scope:'text_only',sources:[{id:'kb.real',title:'真实提供的参考资料',source:{file:'教案.docx',unit:'段',page:2}}]});
test('成效均分与星谱不纳入AI初稿、失效分数和同任务旧版',()=>{
  const grades=[{id:'g1',created:1,assignment_task_id:'task',reviewed:true,items:[item(60)]},{id:'g2',created:2,assignment_task_id:'task',reviewed:true,items:[item(90,2)]},{id:'draft',created:3,reviewed:false,items:[item(99)]},{id:'invalid',reviewed:true,items:[item(NaN)]},{id:'independent',reviewed:true,items:[{...item(70),student_id:''}]}];
  assert.deepEqual(reviewedGradeItems(grades).map(i=>i.total).sort((a,b)=>a-b),[70,90]);const summary=gradeMetricSummary(grades);assert.equal(summary.mean_score,80);assert.equal(summary.reviewed_homework,2);assert.equal(summary.draft_homework,1);assert.equal(summary.distribution.reduce((n,d)=>n+d.count,0),2);
});
test('更晚批改的旧版不能覆盖较新版，未复核空数据不造均分',()=>{
  const grades=[{id:'new',created:1,assignment_task_id:'task',reviewed:true,items:[item(85,2)]},{id:'old-late',created:2,assignment_task_id:'task',reviewed:true,items:[item(50,1)]}];assert.equal(gradeMetricSummary(grades).mean_score,85);assert.equal(gradeMetricSummary([{id:'draft',reviewed:false,items:[item(99)]}]).mean_score,null);
});
test('教师综合评价同时进入反馈文本和CSV评价列，参考资料单位不伪造Word页码',()=>{
  const value=item(80),batch={course:'课程A',term:'2026-2027第一学期',assignment_title:'作业任务',model:'fixture-model',items:[value]};assert.match(reviewFeedback(value),/教师评价应进入导出/);const text=gradeReviewText(batch);for(const actual of ['教师综合评价：教师评价应进入导出','原文：原文证据','教案.docx · 段 2','未据此独立验证'])assert(text.includes(actual));assert(!text.includes('教案.docx · 页 2'));
});
