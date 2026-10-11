import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { importHomework } from '../server/homework-import.mjs';

const output = path.resolve('deliverables/影视鉴赏_100份模拟学生作业');
await mkdir(output, { recursive: true });
const surnames = ['陈','林','王','李','张','刘','赵','周','吴','徐'];
const given = ['语桐','子涵','嘉宁','思远','雨晴','书言','明轩','知夏','予安','若溪'];
const angles = ['门框构图与人物距离','声音如何预告人物出现','手部特写与行动细节','固定镜头中的等待感','剪辑节奏与心理变化','景别变化与信息分配','暖光与人物情感','空镜与空间叙事','画外空间与观众期待','开放结尾与个人解读'];
const opening = [
 '我认为这段短片主要通过等待和相认表达亲情。人物对白较少，但车站的声音和景别变化让情绪逐渐显现。',
 '本次分析关注日常动作如何形成叙事。相比把主题直接说出来，短片把信息藏在握紧车票、看向站台和移开书包等动作中。',
 '我的主要观点是：情感并非由一个特写独立完成，而是由前后镜头的关系共同建立。人物最初被门框分隔，后来进入同一画面。',
 '我把片段理解为一次从误解到接纳的过程。分析时需要区别画面中可以观察的动作和我对人物心理的推测。',
 '我最关注片段怎样保留不确定性。观众先听到声音，再看见来人，最后仍未获得完整对白，这让我主动补足人物关系。'
];
const observations = [
 ['00:00—00:24，固定全景交代小站、长椅和人物位置。门框占据前景，人物处于画面右侧，左边留有空位。','00:25—00:47，手部特写呈现被反复折叠的车票。剪辑从公共空间转向局部动作，等待开始具有个人情绪。','00:48—01:18，来车的声音先进入画面，人物随后抬头。这个先声后画的顺序让观众和人物同时产生期待。'],
 ['00:00—00:24的全景里，人物并未说话，钟声和风声建立了空间的日常感。','01:19—01:48，中景呈现人物起身，镜头缓慢跟随。人物从被动等待变成主动接近，运动方向也把视线带向门口。','01:49—02:17，切入来者的反应近景。两个反应镜头之间没有马上补充对白，观众需要依据视线判断他们的关系。'],
 ['00:25—00:47的车票特写并不解释车票属于谁，但反复折叠的动作可以被观察到。','02:18—02:43，两人进入同一固定中景，原先分开的视线关系转为共享空间。移开书包的动作给另一人留出位置。','02:44—03:00，画面回到站台全景。两人的距离缩短了，远处仍有列车声音，生活继续而关系发生变化。'],
 ['00:48—01:18出现声音提前于来车画面的安排，它把画外空间引入叙事。','01:49—02:17采用反应近景，较前面的全景提供更多表情细节，但并未完整交代人物过去。','02:18—02:43同框后，两人没有拥抱，递出车票和移开书包成为和解的可见行动。'],
 ['00:00—00:24中的门框形成画中画，空间边界使人物显得独处。','01:19—01:48镜头跟随人物起身，景别变化来自人物与摄影机的相对位置，不能仅凭画面变大就称为变焦。','02:44—03:00结尾全景与开头呼应。同一个空间里人物关系已经改变，因此重复构图也产生新的意义。']
];
const interpretations = [
 '门框和空位首先让距离成为可见的形式。后面两人同框时，空间关系改变，情感变化才有具体依据。不过，门框本身不必然等于隔阂，这个判断需要前后镜头共同支持。',
 '环境声不是单纯的背景。声音提前进入时，观众会等待画外对象出现；当对象终于进入画面，前面的期待获得回应。我会把这一安排与普通同步声区分开。',
 '车票是叙事道具，也是身体动作的承载物。折叠车票可以提示紧张，但还可能只是习惯动作，因此不能单凭特写就断言人物内心，应该与视线和后续行动一起分析。',
 '剪辑并没有持续加快。前面的等待镜头较长，反应镜头变短，结尾又回到较稳定的同框画面。我理解为紧张逐渐被日常动作消解，而非简单地把快剪等同于激动。',
 '暖色灯光可以带来柔和的视觉感受，但“暖色就是亲情”仍然过于直接。真正支撑我的判断的是灯光、同框位置、人物动作与情节变化之间的组合关系。'
];
const reflections = [
 '如果把结尾改成拥抱特写，主题会更明确，却可能减少观众参与解读的空间。我更喜欢保留递车票的动作，因为它把情感落实在小事上。',
 '我想尝试把来车声音延后到画面出现之后，比较两种版本的期待感。这样可以检验自己的解释，而不是仅凭“很感人”作结。',
 '这个片段提醒我，分析应先写观察，再提出解释。下次我会记录每个关键镜头的起止时间和声音变化，让论证更容易核对。',
 '我对开放结尾有保留：它让人物关系富有余味，但如果观众缺少前情，也可能只看到一次普通见面。课程讨论可以比较不同理解各自的证据。',
 '我会保留固定全景，减少配乐提示，看看仅靠人物动作能否表达关系变化。这个改动不是断言原作不好，而是帮助我理解形式选择的效果。'
];
const levels = ['完整论证','基本完成','论证待深化','术语待校正','简略作答'];
function sections(index) {
 const quality=Math.floor(index/20), variant=index%5;
 const focus=angles[index%10];
 let evidence=observations[(index+Math.floor(index/5))%5].join('\n');
 let analysis=interpretations[(index+2)%5];
 let reflection=reflections[(index+3)%5];
 if(quality===1)analysis=analysis+' 我还没有逐一对照所有镜头，关于前后节奏的判断需要进一步补充时间记录。';
 if(quality===2){evidence=observations[variant].slice(0,2).join('\n');analysis='这些画面让我感觉人物由孤独变得温暖。'+analysis.split('。')[0]+'。但是我还不能说明每个镜头如何共同支持这个主题。';reflection='我喜欢这个故事，因为生活中的小动作也能表达关心。我会进一步补充声音和剪辑的分析。';}
 if(quality===3){evidence=observations[variant].slice(0,2).join('\n')+'\n我把人物手部的特写称为远景，又把镜头跟随人物起身称为蒙太奇，这两个术语我还没有查清楚。';analysis='我认为暖光一定代表幸福，镜头越近就一定越感人。所以这个片段的每个镜头都很好，不需要结合具体情节再分析。';reflection='我觉得整体很好看，但还没有想到不同拍法会带来什么变化。';}
 if(quality===4){evidence='开头有人坐在车站，后来有人走进来，最后他们坐在一起。我没有记录每一段的时间，也没有区分全景和近景。';analysis='我觉得这段故事是在讲家人团聚，画面和音乐都很好。我注意到车票出现了，但不知道为什么要拍它。';reflection='最喜欢最后坐在一起的画面，感觉挺温暖。以后需要把具体镜头和自己的判断联系起来。';}
 return [
 ['一、分析观点',opening[variant]+' 本文重点讨论'+focus+'。'],
 ['二、镜头观察与证据',evidence],
 ['三、形式与意义',analysis],
 ['四、个人审美与反思',reflection],
 ];
}
const brief='模拟片段《归站》（虚构，时长3分钟）：青年在小站长椅上等待，反复折叠车票；先听到来车声，随后起身。来者与青年交换视线，两人同坐，青年移开书包并递出车票。结尾回到站台全景。本材料未配套真实视频，镜头描述为统一虚构练习设定。';
const roster=[], all={}, batches=Array.from({length:4},()=>({}));
for(let i=0;i<100;i++){
 const id='202601'+String(i+1).padStart(4,'0');
 const name=surnames[Math.floor(i/10)]+given[i%10];
 const batch=Math.floor(i/25)+1;
 const filename=`${id}_${name}_视听语言分析.docx`;
 const children=[new Paragraph({text:'影视鉴赏 · 第一次视听语言分析',heading:HeadingLevel.TITLE})];
 function paragraph(text){return new Paragraph({spacing:{after:160},children:[new TextRun({text,font:'Microsoft YaHei',size:22})]});}
 for(const text of ['模拟作业｜学号、姓名和正文均为虚构，仅用于平台测试。',`学号：${id}`,`姓名：${name}`,'课程：影视鉴赏','学期：2026秋','班级：影视鉴赏模拟班','作业名称：第一次视听语言分析'])children.push(paragraph(text));
 children.push(new Paragraph({text:'练习材料说明',heading:HeadingLevel.HEADING_1}),paragraph(brief));
 for(const [heading,body] of sections(i)){children.push(new Paragraph({text:heading,heading:HeadingLevel.HEADING_1}));for(const line of body.split('\n'))children.push(paragraph(line));}
 const bytes=await Packer.toBuffer(new Document({creator:'镜里知微测试材料',title:'模拟学生影视鉴赏作业',sections:[{properties:{},children}]}));
 const directory=path.join(output,'Word作业',`第${batch}批_25份`);
 await mkdir(directory,{recursive:true});await writeFile(path.join(directory,filename),bytes);
 all[`Word作业/第${batch}批_25份/${filename}`]=new Uint8Array(bytes);batches[batch-1][filename]=new Uint8Array(bytes);
 roster.push({id,name,batch,filename,level:levels[Math.floor(i/20)],focus:angles[i%10]});
}
const csv='\ufeff'+[['学号','姓名','课程','学期','作业名称','批次','文件名'],...roster.map(r=>[r.id,r.name,'影视鉴赏','2026秋','第一次视听语言分析',r.batch,r.filename])].map(r=>r.join(',')).join('\r\n');
const readme=`# 100份模拟学生作业\n\n全部身份和正文均为虚构，不对应真实学生，也不包含预设成绩。\n\n- 共100份DOCX，学号2026010001至2026010100，姓名均不同。\n- 课程：影视鉴赏；学期：2026秋；作业名称：第一次视听语言分析。\n- 使用虚构短片《归站》练习设定，无真实影片，导入时建议不关联实际视频。不能以这些设定检验真实镜头识别准确性。\n- 正文有不同论证和完成水平，含简略作答及术语误用，便于测试反馈差异；不提供标准分数。\n\n## 平台导入\n\n平台每批最多30份。请分别上传4个“可直接导入”ZIP，每包25份；每批批改、复核后清空导入名单，再上传下一批。总压缩包用于保存与分发，请勿直接上传总包。\n填写上述课程、学期、作业名称，核对自动读取的学号姓名，确认后进行AI批改。AI批改会调用已配置的模型并可能产生用量，本次仅生成文件，没有上传或调用模型。\n\n学生名单.csv用于人工核对；测试设计.json记录构造类型，仅供测试，不作为评分标准。\n`;
await writeFile(path.join(output,'学生名单.csv'),csv,'utf8');await writeFile(path.join(output,'使用说明.md'),readme,'utf8');
await writeFile(path.join(output,'测试设计.json'),JSON.stringify(roster,null,2),'utf8');
all['学生名单.csv']=strToU8(csv);all['使用说明.md']=strToU8(readme);all['测试设计.json']=strToU8(JSON.stringify(roster,null,2));
const seenIds=new Set(),seenNames=new Set();
for(let b=0;b<4;b++){
 const filename=`第${b+1}批_25份_可直接导入.zip`;const buffer=zipSync(batches[b],{level:6});
 await writeFile(path.join(output,filename),buffer);
 const imported=await importHomework(await readFile(path.join(output,filename)),filename);
 assert.equal(imported.items.length,25);assert.deepEqual(imported.warnings,[]);
 for(const item of imported.items){assert(!seenIds.has(item.student_id));assert(!seenNames.has(item.student_name));assert(item.student_id&&item.student_name);assert(!item.text.includes(item.student_id));assert(!item.text.includes(item.student_name));assert(item.text.includes('形式与意义'));seenIds.add(item.student_id);seenNames.add(item.student_name);}
}
assert.equal(seenIds.size,100);assert.equal(seenNames.size,100);
const full=zipSync(all,{level:6});const fullpath=path.join(output,'影视鉴赏_100份模拟学生作业_总包.zip');await writeFile(fullpath,full);
const unpacked=unzipSync(await readFile(fullpath));assert.equal(Object.keys(unpacked).filter(n=>n.endsWith('.docx')).length,100);
const result={documents:100,unique_student_ids:seenIds.size,unique_names:seenNames.size,batches:4,imported_per_batch:25,import_warnings:0,identity_redaction:'passed',total_zip_bytes:full.length,total_zip:fullpath};
await writeFile(path.join(output,'验收结果.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
