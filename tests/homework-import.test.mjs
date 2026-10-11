import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {Document,Packer,Paragraph} from 'docx';
import {importHomework,boundedUnzip,identityFrom,anonymizeAssignment} from '../server/homework-import.mjs';
test('DOCX读取学号姓名，身份留作本地名单，正文脱敏',async()=>{
 const buffer=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('学号：002026001'),new Paragraph('姓名：张三'),new Paragraph('张三认为近景突出了人物的表情。')]}]}));
 const result=await importHomework(buffer,'作业.docx');assert.equal(result.items[0].student_id,'002026001');assert.equal(result.items[0].student_name,'张三');assert.ok(!result.text.includes('张三'));assert.ok(!result.text.includes('002026001'));assert.ok(result.text.includes('近景'));
});
test('ZIP批量读取子目录与文件名身份，忽略不支持文件',async()=>{
 const archive=zipSync({'一班/20260001_李四.txt':strToU8('远景交代环境。'),'王五_20260002.txt':strToU8('声音引导情绪。'),'说明.pdf':strToU8('skip')});
 const result=await importHomework(archive,'作业.zip');assert.equal(result.items.length,2);assert.equal(result.items[0].student_name,'李四');assert.equal(result.items[1].student_id,'20260002');assert.equal(result.warnings.length,1);
});
test('拒绝路径穿越、解压大小超限、超过30份、空文档和旧DOC',async()=>{
 assert.throws(()=>boundedUnzip(zipSync({'../attack.txt':strToU8('a')})),/不安全/);
 assert.throws(()=>boundedUnzip(zipSync({'a.txt':strToU8('12345')}),{maxFile:4}),/大小超限/);
 await assert.rejects(importHomework(zipSync(Object.fromEntries(Array.from({length:31},(_,i)=>[i+'.txt',strToU8('x')]))),'many.zip'),/最多30/);
 await assert.rejects(importHomework(Buffer.from(''),'empty.txt'),/20000/);
 await assert.rejects(importHomework(Buffer.from('x'),'legacy.doc'),/另存为DOCX/);
});
test('明确字段优先于文件名，正文中的姓名也移除',()=>{const id=identityFrom('学号：123456 姓名：赵六','999999_李四.docx');assert.equal(id.student_name,'赵六');assert.ok(!anonymizeAssignment('赵六的学号123456',id).includes('赵六'));});
