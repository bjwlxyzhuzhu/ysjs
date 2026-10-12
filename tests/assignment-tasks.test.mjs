import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTask,validateRoster,taskProgress} from '../server/assignment-tasks.mjs';
import {studentReports,abilityReportText} from '../server/student-records.mjs';
const rubric=Array.from({length:5},(_,i)=>({name:'维度'+i,weight:20}));
const body={title:'证据分析',class_name:'一班',academic_year:'2026-2027',semester:'一',instructions:'用画面证据说明观点',rubric};
test('任务固定教师课程、规范学期，拒绝非法名单与量规',()=>{
  const task=validateTask({...body,course:'越权课程'}, {id:'course-a',name:'课程A'},rubric);
  assert.equal(task.course,'课程A');assert.equal(task.term,'2026-2027学年 第一学期');
  assert.throws(()=>validateTask({...body,academic_year:'2026-2028'},{},rubric));
  assert.throws(()=>validateTask({...body,semester:'三'},{},rubric));
  assert.throws(()=>validateTask({...body,rubric:rubric.map(r=>({...r,weight:30}))},{},rubric));
  assert.throws(()=>validateTask({...body,clip_id:{}},{},rubric));
  assert.throws(()=>validateRoster([{student_id:'001',student_name:'甲'},{student_id:'001',student_name:'乙'}]));
  assert.throws(()=>validateRoster([{student_id:'',student_name:'甲'}]));
  assert.deepEqual(validateRoster([{student_id:'001',student_name:'甲'}]),[{student_id:'001',student_name:'甲'}]);
});
test('已交与复核独立统计，新版不沿用旧版分数；未设名单不虚构未交',()=>{
  const task={id:'task',deadline:new Date(100).toISOString(),roster:[{student_id:'001',student_name:'甲'},{student_id:'002',student_name:'乙'}]};
  const submissions=[{id:'sub',task_id:'task',student_id:'001',student_name:'甲',revision:2,submitted:200}];
  const grades=[{id:'g',assignment_task_id:'task',reviewed:true,items:[{submission_id:'sub',submission_revision:1,total:80}]}];
  const pending=taskProgress(task,submissions,grades);assert.equal(pending.submitted,1);assert.equal(pending.reviewed,0);assert.equal(pending.late,1);assert.equal(pending.submissions[0].score,null);assert.deepEqual(pending.missing,[task.roster[1]]);
  grades.push({id:'g2',assignment_task_id:'task',created:2,reviewed:false,items:[{submission_id:'sub',submission_revision:2,total:90}]});
  assert.equal(taskProgress(task,submissions,grades).pending_review,1);grades[1].reviewed=true;
  assert.equal(taskProgress(task,submissions,grades).submissions[0].score,90);
  assert.equal(taskProgress({...task,roster:[]},submissions,grades).expected,null);
});
test('同一任务重复批改只计最新已复核版本，历史评价与独立作业保留',()=>{
  const item=(score,version)=>({id:'x',student_id:'001',student_name:'甲',submission_revision:version,total:score,dimensions:[{name:'分析',score}],comments:[],teacher_comment:'原有评价'});
  const grades=[{id:'g1',assignment_task_id:'task',created:1,reviewed:true,items:[item(60,1)]},{id:'g2',assignment_task_id:'task',created:2,reviewed:true,items:[item(90,2)]},{id:'g3',assignment_task_id:'task',created:3,reviewed:false,items:[item(100,3)]},{id:'other',created:4,reviewed:true,items:[item(80,1)]}];
  const report=studentReports(grades).students[0];assert.equal(report.course_score,85);assert.equal(report.reviewed_count,2);assert.equal(report.assignment_count,2);assert.equal(report.records.length,4);assert.equal(report.records[0].superseded,true);assert.match(abilityReportText(report),/历史版本/);
});
