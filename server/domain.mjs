import {canonicalKnowledgeIds} from './knowledge-index.mjs';
import { readFileSync } from 'node:fs';
export const fields = ['shot_size','angle','movement','composition','lighting','sound','av_relation','transition','function','knowledge_ids'];
export const options = {shot_size:['大远景','远景','全景','中景','近景','特写','不适用（图文/录屏）','无法判断'], angle:['平拍','仰拍','俯拍','倾斜','无法判断'], movement:['固定','推','拉','摇','移','跟','升降','手持','无法判断'], av_relation:['同步','对位','无法判断'], transition:['切','叠化','淡入淡出','匹配剪辑','无法判断']};
export const rubric = [{name:'镜头要素识别准确性',weight:30},{name:'术语使用规范性',weight:15},{name:'形式—意义分析深度',weight:30},{name:'结构与论证',weight:15},{name:'个人审美见解',weight:10}];
export const knowledge = JSON.parse(readFileSync(new URL('../knowledge/knowledge.json',import.meta.url),'utf8'));
export function retrieve(query){const s=String(query);return knowledge.map(k=>({...k,score:k.keywords.filter(x=>s.includes(x)).length})).filter(k=>k.score>0).sort((a,b)=>b.score-a.score).slice(0,3);}
export function validateAnnotation(raw,catalogue=knowledge){
 const out={}; for(const f of fields){if(options[f]) {if(!options[f].includes(raw[f])) throw Error('模型返回无效枚举：'+f);out[f]=raw[f];}
 else if(['sound','knowledge_ids'].includes(f)){if(!Array.isArray(raw[f])||raw[f].some(x=>typeof x!=='string'))throw Error('模型返回无效列表：'+f);out[f]=raw[f].slice(0,10);}
 else {if(typeof raw[f]!=='string'||raw[f].length>3000)throw Error('模型返回无效字段：'+f);out[f]=raw[f];}}
 out.knowledge_ids=canonicalKnowledgeIds(out.knowledge_ids,catalogue);
 if(!Number.isFinite(raw.confidence)||raw.confidence<0||raw.confidence>1) throw Error('置信度无效');out.confidence=raw.confidence;return out;
}
export function redact(text){return String(text).replace(/(?:姓名|学生姓名|学号|学校|学院|班级)\s*[:：]\s*[^\n\r，,；;]+/g,'[身份信息已移除]').replace(/1[3-9]\d{9}/g,'[联系方式已移除]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[邮箱已移除]');}
export function validSources(item,shots,evidence=shots.flatMap(s=>s.knowledge_ids||[]),catalogue=knowledge){return Array.isArray(item.shot_ids)&&item.shot_ids.length>0&&item.shot_ids.every(id=>shots.some(s=>s.id===id))&&Array.isArray(item.knowledge_ids)&&item.knowledge_ids.length>0&&item.knowledge_ids.every(id=>catalogue.some(k=>k.id===id)&&evidence.includes(id));}
export function validateLesson(raw,shots,evidence=shots.flatMap(s=>s.knowledge_ids||[]),catalogue=knowledge){
 if(!Array.isArray(raw?.slides)||raw.slides.length<3||raw.slides.length>5||!Array.isArray(raw.questions)||raw.questions.length!==5)throw Error('课件需3至5页、讨论题需5道');
 const entries=[...raw.slides.map((x,i)=>[`课件第${i+1}页`,x]),...raw.questions.map((x,i)=>[`讨论题第${i+1}题`,x]),['板书',raw.board],['导入语',raw.introduction]];
 for(const [name,x] of entries){if(!x||typeof x.title!=='string'||!x.title.trim()||typeof x.content!=='string'||!x.content.trim()||x.title.length>300||x.content.length>10000)throw Error(name+'缺少有效标题或正文');if(!validSources(x,shots,evidence,catalogue))throw Error(name+'缺少有效镜头或知识点引用，请使用本次提供的shot_ids和knowledge_ids');}
 for(const q of raw.questions)if(!['理解','分析','评价','创造'].includes(q.level))throw Error('讨论题层级无效');return raw;
}
export function validateGrade(raw,text,weights=rubric){
 if(!Array.isArray(raw.dimensions)||raw.dimensions.length!==5||!Array.isArray(raw.comments)||!raw.comments.length||typeof raw.suggestion!=='string')throw Error('批改结构无效');
 let total=0; raw.dimensions.forEach((d,i)=>{if(d.name!==weights[i].name||!Number.isFinite(d.score)||d.score<0||d.score>100||typeof d.reason!=='string')throw Error('分项分数无效');total+=d.score*weights[i].weight/100;});
 for(const c of raw.comments)if(typeof c.quote!=='string'||!c.quote.trim()||!text.includes(c.quote)||typeof c.comment!=='string')throw Error('批注原文无法追溯');
 raw.total=Math.round(total*10)/10;return raw;
}
