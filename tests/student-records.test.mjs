import {test} from 'node:test';import assert from 'node:assert/strict';
import {studentReports,courseMetadata,abilityReportText} from '../server/student-records.mjs';
const item=(score,id='002026001')=>({id:'001',student_id:id,student_name:'测试学生',total:score,dimensions:[{name:'形式—意义分析深度',score,reason:'依据原文'}],comments:[{quote:'近景',comment:'补充证据'}],suggestion:'结合时间码',teacher_comment:'论证有所进步'});
test('成绩仅汇总已复核作业，学号保留前导零，课程学期分别归档',()=>{
 const grades=[{id:'a',created:1,course:'影视鉴赏',term:'2026秋',reviewed:true,items:[item(80)]},{id:'b',created:2,course:'影视鉴赏',term:'2026秋',reviewed:true,items:[item(90)]},{id:'c',created:3,course:'影视鉴赏',term:'2026秋',reviewed:false,items:[item(100)]},{id:'d',course:'影视鉴赏',term:'2027春',reviewed:true,items:[item(60)]},{id:'e',reviewed:true,items:[item(50,'')]}];
 const result=studentReports(grades);assert.equal(result.students.length,2);assert.equal(result.unidentified,1);const report=result.students.find(x=>x.term==='2026秋');assert.equal(report.student_id,'002026001');assert.equal(report.course_score,85);assert.equal(report.abilities[0].score,85);assert.equal(report.trend,10);assert.equal(report.assignment_count,3);assert.match(abilityReportText(report),/85 \/ 100/);assert.match(abilityReportText(report),/论证有所进步/);
});
test('旧批改记录兼容默认课程，非法课程字段拒绝',()=>{assert.equal(studentReports([{id:'a',reviewed:false,items:[item(80)]}]).students[0].course,'影视鉴赏');assert.equal(studentReports([{id:'a',reviewed:false,items:[item(80)]}]).students[0].course_score,null);assert.throws(()=>courseMetadata({course:{}}));});
