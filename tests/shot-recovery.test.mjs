import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sameRange,uniqueShots,checkpoint,restoreCheckpoint,teacherEvidence} from '../server/shot-recovery.mjs';
import {initializeCourses,teacherCourses,assignedCourse} from '../server/courses.mjs';
test('近重复时间区间保留教师复核；相邻镜头和不同时间的同场景不误删',()=>{
 const shots=[{id:'a',start:0,end:10,status:'ai_draft'},{id:'b',start:.05,end:10.05,status:'teacher_reviewed'},{id:'c',start:10,end:20},{id:'d',start:20,end:30}];
 assert(sameRange(shots[0],shots[1]));const result=uniqueShots(shots);assert.deepEqual(result.map(x=>x.id),['b','c','d']);assert.deepEqual(result.map(x=>x.index),[1,2,3]);
});
test('快照深拷贝、最多10步；撤销恢复删除列表和教师选片状态',()=>{
 const clip={shots:[{id:'a',start:0,end:1}],selection:[{start:0,end:1}],manual_selection:true,excluded_ranges:[]};checkpoint(clip,'删除');clip.shots[0].id='changed';clip.excluded_ranges.push({start:2,end:3});assert.equal(restoreCheckpoint(clip),'删除');assert.equal(clip.shots[0].id,'a');assert.equal(clip.excluded_ranges.length,0);assert.equal(clip.manual_selection,true);for(let i=0;i<12;i++)checkpoint(clip,'step '+i);assert.equal(clip.shot_history.length,10);
});
test('空知识库允许教师自填教学要点，标明教师来源，不伪造课程引用',()=>{
 const result=teacherEvidence([{id:'s',index:1,knowledge_ids:['fake'],teaching_point:'依据对比画面讨论语言与文化。'}],[]);assert.deepEqual(result.shots[0].knowledge_ids,['teacher.s']);assert.equal(result.catalogue[0].source.file,'教师镜头标注');assert.equal(result.catalogue[0].summary,'依据对比画面讨论语言与文化。');
});
test('课程关系迁移保留已有课程，不给新教师强制分配影视鉴赏',()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE users(username TEXT PRIMARY KEY,role TEXT,course_id TEXT);INSERT INTO users VALUES('legacy','teacher','film-appreciation'),('new','teacher','')");initializeCourses(db);initializeCourses(db);assert.equal(teacherCourses(db,{username:'legacy'}).length,1);assert.equal(teacherCourses(db,{username:'new'}).length,0);assert.equal(assignedCourse(db,{course_id:''}),null);db.close();
});
