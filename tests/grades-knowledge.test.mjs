import {test} from 'node:test';import assert from 'node:assert/strict';
import {chapterKnowledge,canonicalKnowledgeIds,uploadFilename} from '../server/knowledge-index.mjs';
import {gradesInCourse,gradeRows,studentReports} from '../server/student-records.mjs';
test('章节标题聚合多段大纲，最多18点，原文出处与旧引用不丢失',()=>{
 const sections=[];for(let chapter=1;chapter<=3;chapter++){sections.push({text:`第${chapter}章 ${['故事核心与选题','角色与冲突','视听表达'][chapter-1]}`,page:sections.length+1,unit:'段'});for(let n=0;n<25;n++)sections.push({text:`教学要求${chapter}-${n}：从课堂素材识别证据并设计实践。`,page:sections.length+1,unit:'段'});}
 const doc={id:'doc-a',type:'教学大纲',title:'2026-2027-1 教学大纲',filename:'动画短片剧本创意思维.docx',sections};const points=chapterKnowledge(doc);assert.equal(points.length,3);assert.match(points[1].title,/角色与冲突/);assert(!points[0].title.includes(doc.id));assert.equal(points[0].source.file,doc.filename);assert.equal(points[0].source.page,1);assert.equal(points[0].source.end_page,26);for(const s of sections)assert(points.some(k=>k.full_text.includes(s.text)));assert.deepEqual(canonicalKnowledgeIds(['kb.doc-a.27.1'],points),[points[1].id]);
 const many=chapterKnowledge({...doc,sections:Array.from({length:60},(_,i)=>({text:'第'+(i+1)+'章 知识'+i,page:i+1,unit:'段'}))});assert.equal(many.length,18);assert.equal(many.flatMap(k=>k.aliases).length,60);
});
test('中文上传文件名仅在确为UTF8被Latin1误读时解码，不破坏已正确的中文名',()=>{
 const file='2026-2027-1《动画短片剧本创意思维》教学大纲.docx';assert.equal(uploadFilename(file),file);assert.equal(uploadFilename(Buffer.from(file).toString('latin1')),file);assert.equal(uploadFilename('folder/'+file),file);assert.equal(uploadFilename('a'.repeat(250)+'.docx').slice(-5),'.docx');
});
test('批改清单保留缺学号与AI初稿，档案兼容数字学号，课程口径一致',()=>{
 const item=(id,name='测试学生')=>({student_id:id,student_name:name,total:85,dimensions:[{name:'理解',score:85,reason:'有依据'}],comments:[],suggestion:'完善论据'}),course={id:'film-appreciation',name:'影视鉴赏'};
 const grades=[{id:'old',course:'影视鉴赏',reviewed:true,items:[item('002026001')]},{id:'missing',reviewed:false,items:[item('','')]},{id:'number',course_id:course.id,course:'旧课程显示名',reviewed:true,items:[item(2026002)]},{id:'other',course_id:'other',course:'影视鉴赏',items:[item('99')]}],scoped=gradesInCourse(grades,course);
 assert.equal(scoped.length,3);const rows=gradeRows(scoped);assert.equal(rows.length,3);assert.equal(rows.find(r=>r.batch_id==='missing').student_id,'');assert.equal(rows.find(r=>r.batch_id==='missing').reviewed,false);assert(rows.every(r=>r.course===course.name));assert.equal(studentReports(scoped).students.length,2);assert.equal(studentReports(scoped).unidentified,1);assert.equal(rows[0].student_id,'002026001');
});
