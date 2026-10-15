import path from 'node:path';
export function uploadFilename(value){
 let name=String(value||'资料');
 if([...name].every(c=>c.charCodeAt(0)<=255)){const decoded=Buffer.from(name,'latin1').toString('utf8');if(!decoded.includes('\ufffd')&&Buffer.from(decoded,'utf8').equals(Buffer.from(name,'latin1')))name=decoded;}
 name=name.replace(/.*[\\/]/,'').replace(/[\u0000-\u001f]/g,'').trim();const ext=path.extname(name);return name.length>200?name.slice(0,200-ext.length)+ext:name||'资料';
}
export function canonicalKnowledgeIds(ids,catalogue){
 const map=new Map();for(const k of catalogue){map.set(k.id,k.id);for(const alias of k.aliases||[])map.set(alias,k.id);}return [...new Set((ids||[]).map(id=>map.get(id)).filter(Boolean))];
}
const heading=line=>{
 const s=line.trim().replace(/^#{1,6}\s*/,'');if(!s||s.length>70)return null;
 if(/^(第[一二三四五六七八九十百\d]+[章编篇单元节讲]|(?:单元|模块|专题|项目)\s*[一二三四五六七八九十\d]+)/.test(s))return {title:s,major:true};
 if(/^\d+(?:\.\d+){0,2}[.、．\s]\s*[^\d]/.test(s)||/^[一二三四五六七八九十]+[、.．]\s*\S/.test(s))return {title:s,major:false};
 if(/^(课程目标|教学目标|教学内容|教学重点|教学难点|课程考核|考核评价|教学方法|学时安排|学习成果|创作实践|教学要求)(?:\s*[:：]\s*)?$/.test(s))return {title:s.replace(/[:：]\s*$/,''),major:false};
 return null;
};
function concise(text,fallback){
 const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const h=lines.map(heading).find(Boolean);if(h)return h.title.slice(0,44);
 const first=lines.find(s=>s.length>=4&&!/^(?:课程名称|课程代码|学分|学时|适用专业|开课单位|制订人|审核人|版本|\d{4}-\d{4})/.test(s))||fallback;
 return first.replace(/^[\s#]+/,'').split(/[。；;!?！？]/)[0].slice(0,38)||fallback;
}
// Group original paragraphs/pages instead of turning each paragraph into a menu
// entry. Every legacy chunk id remains an alias and every source is retained.
export function chapterKnowledge(document,max=18){
 const groups=[];let group=null,hasMajor=false;
 for(const section of document.sections||[]){
  const lines=section.text.split(/\r?\n/),parts=[];let current=[];
  for(const line of lines){const h=heading(line);if(h&&current.length){parts.push(current.join('\n'));current=[];}current.push(line);}if(current.length)parts.push(current.join('\n'));
  const aliases=Array.from({length:Math.ceil(section.text.length/1100)},(_,i)=>`kb.${document.id}.${section.page}.${i+1}`);
  for(const text of parts){if(!text.trim())continue;const first=text.trim().split('\n')[0],h=heading(first),shouldSplit=h&&(h.major||!hasMajor);
   if(!group||shouldSplit||!h&&!hasMajor&&group.texts.join('').length>8000){group={title:h?.title||'',texts:[],locations:[],aliases:[]};groups.push(group);}if(h?.major)hasMajor=true;
   if(!group.texts.includes(text.trim()))group.texts.push(text.trim());group.locations.push({page:section.page,unit:section.unit});group.aliases.push(...aliases);
  }
 }
 if(groups.length>max){const merged=[];for(let i=0;i<groups.length;i++){const bucket=Math.min(max-1,Math.floor(i*max/groups.length));if(!merged[bucket])merged[bucket]={...groups[i],texts:[],locations:[],aliases:[]};for(const k of ['texts','locations','aliases'])merged[bucket][k].push(...groups[i][k]);}groups.splice(0,groups.length,...merged);}
 const usedIds=new Set(),usedAliases=new Set();return groups.map((g,i)=>{
  const full_text=g.texts.join('\n\n'),aliases=[...new Set(g.aliases)].filter(id=>{if(usedAliases.has(id))return false;usedAliases.add(id);return true;}),locations=[...new Map(g.locations.map(s=>[s.page+'-'+s.unit,s])).values()],first=locations[0],last=locations.at(-1);
  let id=aliases.find(id=>!usedIds.has(id))||`kb.${document.id}.chapter.${i+1}`;usedIds.add(id);
  const title=(g.title||concise(full_text,document.type+'要点')).slice(0,48);
  return {id,aliases,chapter:document.type,title,summary:full_text.slice(0,600),excerpt:full_text.slice(0,6000),full_text,excerpt_truncated:full_text.length>6000,keywords:[title],source:{file:uploadFilename(document.filename),page:first.page,end_page:last.page,unit:first.unit,locations,material_id:document.id},status:'教师已复核',references:0};
 });
}
