import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const chapters=['影视鉴赏导论与影像素养','镜头、画面与视觉造型','剪辑、叙事与时空结构','声音、音乐与 AI 配音鉴赏','类型电影、短剧与网络视听','中国电影、文化表达与课程思政','地方影像、周秦文化与文旅传播','AIGC 影像与 AI 时代媒介伦理','综合影视鉴赏、学生展示与课程评价'];
const terms=['景别','远景','全景','中景','近景','特写','情绪','镜头','角度','平视','仰视','俯视','构图','三分','对称','光影','顺光','侧光','逆光','色彩','场面调度','推镜头','拉镜头','摇镜头','移镜头','运镜','剪辑','蒙太奇','平行','交叉','连续性','叙事','节奏','时空','长镜头','跳切','转场','声音','音乐','音响','静默','声画','同步','对位','画外','配音','类型','短剧','纪录片','文化','周秦','文旅','AIGC','AI','伦理','版权','真实性','证据','观点','评价','量规','影评','媒介素养'];
const clean=text=>text.split('\n').filter(s=>!/(宝\s*鸡\s*文\s*理|文\s*理\s*学\s*院|文\s*学\s*与\s*新\s*闻\s*传\s*播|教师\s*[:：]|主讲\s*[:：])/.test(s)).map(s=>s.replace(/《影视鉴赏》精品课件/g,'').replace(/第\s*\d+\s*页/g,'').replace(/[■□◆★]+/g,'').trim()).filter(s=>s&&!/^[\d\s①②③④⑤⑥⑦⑧⑨·|—一]+$/.test(s)).join('\n');
const overrides={'2-4':'景别：远景、全景、中景、近景与特写','2-5':'角度与视点','2-6':'构图与视觉信息组织','2-7':'光影与空间情绪','2-8':'色彩与情绪表达','2-9':'场面调度','2-11':'镜头运动：推、拉、摇、移','3-3':'剪辑的定义与核心功能','3-4':'蒙太奇的概念与功能','3-5':'连续性剪辑与空间关系','3-7':'镜头时长与剪辑节奏','3-11':'平行蒙太奇与交叉剪辑','3-14':'转场方式与叙事衔接','4-3':'影视声音的四个层次','4-7':'静默、留白与声画关系','4-15':'声音与画面的关系','9-4':'片段分析的基本流程','9-14':'影评写作：观点、证据与结构'};
const entries=[],manifest=[];
for(let i=1;i<=9;i++){
 const filename=`knowledge/source-text/topic-${i}.json`;const data=JSON.parse(await fs.readFile(filename,'utf8'));data.pages=data.pages.map(p=>({...p,text:clean(p.text)}));await fs.writeFile(filename,JSON.stringify(data,null,2));
 let sha256=null;if(process.argv[2])sha256=createHash('sha256').update(await fs.readFile(path.join(process.argv[2],data.file))).digest('hex');
 manifest.push({file:data.file,pages:data.pages.length,sha256,chapter:chapters[i-1],extraction:'PDF 内嵌文本提取，可能存在排版顺序与识别误差；未作逐页人工校订'});
 for(const p of data.pages.filter(p=>p.page>=2)){
  const candidates=p.text.split('\n').map(s=>s.replace(/^专题\d+\s*[|｜]?\s*/,'').trim()).filter(s=>s.length>=7&&!s.includes(chapters[i-1])&&!/^通识教育|^一 通识|^专题\d+|^学习目标|^知识目标|^能力目标|^素养目标|^价值目标/.test(s));
  const title=p.page===2?'学习目标与教学重点':overrides[`${i}-${p.page}`]||candidates[0]||'课程分析与课堂任务';
  const excerpt=p.text;entries.push({id:`t${i}.p${String(p.page).padStart(2,'0')}`,chapter:`专题 ${i} · ${chapters[i-1]}`,title:title.slice(0,70),summary:excerpt.slice(0,650),excerpt,keywords:terms.filter(t=>excerpt.includes(t)),source:{file:data.file,page:p.page},status:'source_extracted'});
 }
}
await fs.writeFile('knowledge/knowledge.json',JSON.stringify(entries,null,2));await fs.writeFile('knowledge/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:manifest.length,pages:manifest.reduce((n,m)=>n+m.pages,0),knowledge_entries:entries.length,characters:entries.reduce((n,k)=>n+k.excerpt.length,0)}));
