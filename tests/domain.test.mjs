import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knowledge, validateAnnotation, validateGrade, redact, validateLesson, retrieve, rubric } from '../server/domain.mjs';
test('不匹配的检索返回空，不将无关材料当依据',()=>assert.deepEqual(retrieve('xyz-unrelated-987'),[]));
test('非有限评分拒绝；不允许引用未提供的真实知识点',()=>{
 const item={title:'观察',content:'分析',shot_ids:['s1'],knowledge_ids:['t3.p04']};
 assert.throws(()=>validateLesson({slides:Array(3).fill(item),questions:Array(5).fill({...item,level:'分析'}),board:item,introduction:item},[{id:'s1',knowledge_ids:['t2.p04']}]));
 assert.throws(()=>validateGrade({dimensions:rubric.map(r=>({name:r.name,score:NaN,reason:'原因'})),comments:[{quote:'原文',comment:'意见'}],suggestion:'建议'},'原文'));
});
test('课程来源覆盖九个专题，页码可追溯，展示知识中无学校页脚',()=>{assert.equal(knowledge.length,171);assert.equal(new Set(knowledge.map(k=>k.source.file)).size,9);for(const k of knowledge){assert.ok(k.source.page>=2&&k.source.page<=20);assert.ok(k.excerpt.length>20);assert.doesNotMatch(JSON.stringify(k),/文\s*理\s*学\s*院|文\s*学\s*与\s*新\s*闻\s*传\s*播/);}});
test('拒绝无效视觉枚举及置信度，过滤虚构知识点',()=>{const a={shot_size:'近景',angle:'平拍',movement:'固定',composition:'主体居中',lighting:'侧光',sound:[],av_relation:'无法判断',transition:'切',function:'细节观察',knowledge_ids:['t2.p04','不存在'],confidence:.8};assert.deepEqual(validateAnnotation(a).knowledge_ids,['t2.p04']);assert.throws(()=>validateAnnotation({...a,movement:'AI想象的运镜'}));assert.throws(()=>validateAnnotation({...a,confidence:1.5}));});
test('姓名、学校、学号与联系方式在入库前脱敏',()=>{assert.doesNotMatch(redact('姓名：测试姓名\n学校：测试学校\n学号：123456\n电话13812345678 test@example.com'),/测试姓名|测试学校|123456|13812345678|test@example/);});
test('评分总分由量规计算，批注必须真实出现在作业原文',()=>{const text='近景强调了人物的表情。';const raw={dimensions:['镜头要素识别准确性','术语使用规范性','形式—意义分析深度','结构与论证','个人审美见解'].map(name=>({name,score:80,reason:'观察证据'})),comments:[{quote:'人物的表情',comment:'补充镜头时间码'}],suggestion:'补充依据',total:100};assert.equal(validateGrade(raw,text).total,80);assert.throws(()=>validateGrade({...raw,comments:[{quote:'不存在的原文',comment:'评语'}]},text));});
test('备课材料必须引用真实复核镜头和课程知识点',()=>{const item={title:'观察',content:'分析',shot_ids:['s1'],knowledge_ids:['t2.p04']};const raw={slides:Array(3).fill(item),questions:Array(5).fill({...item,level:'分析'}),board:item,introduction:item};assert.equal(validateLesson(raw,[{id:'s1',knowledge_ids:['t2.p04']}]).questions.length,5);assert.throws(()=>validateLesson({...raw,board:{...item,shot_ids:['虚构']}},[{id:'s1',knowledge_ids:['t2.p04']}]));});
