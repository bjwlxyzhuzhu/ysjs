import {chapterKnowledge,uploadFilename} from './knowledge-index.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import mammoth from 'mammoth';
import multer from 'multer';
import {boundedUnzip,anonymizeAssignment,identityFrom} from './homework-import.mjs';
import {DEFAULT_COURSE,assignedCourse} from './courses.mjs';
export const materialTypes=['教学大纲','课件','论文','教案','讲义','课堂实录','试卷','习题','批改记录'];
const bad=message=>Object.assign(Error(message),{status:400}),MB=1024*1024;
const textExtensions=/\.(docx|pdf|pptx|xlsx|txt|md|csv|json|srt|vtt)$/i,mediaExtensions=/\.(mp4|webm|m4a|mp3|wav)$/i;
const xmlText=s=>s.replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').trim();
function limitText(text){if(text.length>500000)throw bad('单份资料正文超过50万字，请拆分文件');return text.replace(/\u0000/g,'').trim();}
function stripIdentityJSON(value){if(Array.isArray(value))return value.map(stripIdentityJSON);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/student_?(?:id|name)|姓名|学号|班级|手机号|邮箱|联系方式/i.test(k)).map(([k,v])=>[k,stripIdentityJSON(v)]));return value;}
function maskTable(text){
 const sep=text.split(/\r?\n/,1)[0]?.includes('\t')?'\t':',';const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<=text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(ch===sep||ch==='\n'||ch===undefined)){row.push(cell);cell='';if(ch!==sep){rows.push(row);row=[];}}else if(ch!=='\r')cell+=ch;}
 const privateColumns=rows[0]?.map((x,i)=>/姓名|学号|班级|邮箱|手机|student_?(?:id|name)/i.test(x)?i:-1).filter(i=>i>=0)||[];
 return privateColumns.length?rows.map(row=>row.map((v,i)=>privateColumns.includes(i)?'[身份已移除]':v).join('\t')).join('\n'):text;
}
export async function extractTeachingFile(buffer,filename,type){
 if(buffer.length>20*MB)throw bad('文本资料单份不得超过20MB；请拆分文件');
 const ext=path.extname(filename).toLowerCase();let sections=[];
 if(ext==='.docx'){boundedUnzip(buffer,{maxFiles:1000,maxTotal:60*MB,maxFile:20*MB});sections=(await mammoth.extractRawText({buffer})).value.split(/\n\s*\n/).filter(x=>x.trim()).map((text,i)=>({text,page:i+1,unit:'段'}));}
 else if(ext==='.pdf'){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
  try{const pdf=await task.promise;if(pdf.numPages>300)throw bad('PDF最多300页，请拆分');for(let page=1;page<=pdf.numPages;page++){const content=await(await pdf.getPage(page)).getTextContent();sections.push({text:content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''),page,unit:'页'});}}finally{await task.destroy();}
 }else if(ext==='.pptx'){
  const files=boundedUnzip(buffer,{maxFiles:2000,maxTotal:80*MB,maxFile:20*MB});const slides=Object.keys(files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  sections=slides.map(n=>({page:Number(n.match(/slide(\d+)/)[1]),unit:'张幻灯片',text:[...Buffer.from(files[n]).toString('utf8').matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>xmlText(m[1])).join('\n')}));
 }else if(ext==='.xlsx'){
  const files=boundedUnzip(buffer,{maxFiles:1000,maxTotal:60*MB,maxFile:20*MB});const strings=[...Buffer.from(files['xl/sharedStrings.xml']||[]).toString('utf8').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>xmlText(m[1]));
  const sheets=Object.keys(files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  sections=sheets.map((n,i)=>({page:i+1,unit:'张工作表',text:[...Buffer.from(files[n]).toString('utf8').matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)].map(row=>[...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(c=>/t="s"/.test(c[1])?strings[Number(c[2].match(/<v>(.*?)<\/v>/)?.[1])]||'':xmlText(c[2])).join('\t')).join('\n')}));
 }else if(['.txt','.md','.csv','.srt','.vtt','.json'].includes(ext)){
  let text=buffer.toString('utf8').replace(/^\ufeff/,'');if(ext==='.json'){try{text=JSON.stringify(stripIdentityJSON(JSON.parse(text)),null,2);}catch{throw bad('JSON资料格式无效');}}
  sections=text.split(/\n\s*\n/).filter(x=>x.trim()).map((text,i)=>({text,page:i+1,unit:'段'}));
 }else throw bad('请上传DOCX、PDF、PPTX、XLSX、TXT、MD、CSV、JSON或转写字幕；旧DOC/PPT请另存为新格式');
 const identity=type==='批改记录'?identityFrom(sections.map(s=>s.text).join('\n'),filename):{};
 sections=sections.map(s=>({...s,text:limitText(anonymizeAssignment(type==='批改记录'?maskTable(s.text):s.text,identity))})).filter(s=>s.text);
 limitText(sections.map(s=>s.text).join('\n\n'));return sections;
}
export function chunksFor(document){return chapterKnowledge(document);}
export function searchCatalogue(query,catalogue,max=6){
 const q=String(query).toLowerCase();const terms=[...new Set([...(q.match(/[a-z0-9_-]{2,}/g)||[]),...(q.match(/[\p{Script=Han}]{2,}/gu)||[]).flatMap(word=>[...word].slice(0,80).flatMap((_,i)=>i<word.length-1?[word.slice(i,i+2)]:[]))])].slice(0,100);
 if(!terms.length)return [];return catalogue.map(k=>({k,score:terms.reduce((n,t)=>n+(String(k.title+' '+(k.full_text||k.summary)+' '+(k.keywords||[]).join(' ')).toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,max).map(({k})=>{if(!k.full_text)return k;const hits=terms.map(t=>k.full_text.toLowerCase().indexOf(t)).filter(i=>i>=0),start=hits.length?Math.max(0,Math.min(...hits)-350):0;return {...k,excerpt:k.full_text.slice(start,start+6000),excerpt_truncated:k.full_text.length>6000};});
}
export function createTeachingLibrary({db,data,baseKnowledge}){
 db.exec("CREATE TABLE IF NOT EXISTS teaching_materials(id TEXT PRIMARY KEY,owner TEXT NOT NULL,course_id TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS materials_scope ON teaching_materials(owner,course_id); CREATE TABLE IF NOT EXISTS library_settings(owner TEXT,course_id TEXT,mode TEXT,PRIMARY KEY(owner,course_id))");
 const documents=(owner,courseId)=>db.prepare('SELECT payload FROM teaching_materials WHERE owner=? AND course_id=? ORDER BY rowid DESC').all(owner,courseId).map(r=>JSON.parse(r.payload));
 const mode=(owner,courseId)=>db.prepare('SELECT mode FROM library_settings WHERE owner=? AND course_id=?').get(owner,courseId)?.mode||(courseId===DEFAULT_COURSE?'builtin':'private');
 const catalogue=(owner,courseId=DEFAULT_COURSE)=>[...(courseId===DEFAULT_COURSE&&mode(owner,courseId)==='builtin'?baseKnowledge:[]),...documents(owner,courseId).filter(d=>d.status==='ready').flatMap(chunksFor)];
 const summary=d=>{const {sections,file,...out}=d;return {...out,filename:uploadFilename(d.filename),title:uploadFilename(d.title),chunks:d.status==='ready'?chunksFor(d).length:0,characters:sections.reduce((n,s)=>n+s.text.length,0)};};
 function own(id,owner,courseId){const row=db.prepare('SELECT payload FROM teaching_materials WHERE id=? AND owner=? AND course_id=?').get(id,owner,courseId);if(!row)throw Object.assign(Error('未找到当前课程的资料'),{status:404});return JSON.parse(row.payload);}
 const persist=d=>db.prepare('INSERT OR REPLACE INTO teaching_materials VALUES(?,?,?,?)').run(d.id,d.owner,d.course_id,JSON.stringify(d));
 function register(app,teacher){
  const scope=req=>({owner:req.user.username,courseId:assignedCourse(db,req.user).id});
  app.get('/api/materials',(req,res)=>{const {owner,courseId}=scope(req);res.json({mode:mode(owner,courseId),builtin_available:courseId===DEFAULT_COURSE,course:assignedCourse(db,req.user),types:materialTypes,documents:documents(owner,courseId).map(summary),knowledge_count:catalogue(owner,courseId).length});});
  app.patch('/api/materials/settings',teacher,(req,res)=>{const {owner,courseId}=scope(req);if(!['builtin','private'].includes(req.body.mode)||req.body.mode==='builtin'&&courseId!==DEFAULT_COURSE)throw bad('请选择当前课程可用的大纲来源');db.prepare('INSERT OR REPLACE INTO library_settings VALUES(?,?,?)').run(owner,courseId,req.body.mode);res.json({ok:true});});
  const uploader=multer({dest:data,limits:{fileSize:200*MB,files:1}});
  app.post('/api/materials',teacher,uploader.single('file'),async(req,res)=>{
   if(!req.file)throw bad('请选择教学资料');const {owner,courseId}=scope(req),type=req.body.type;
   const filename=uploadFilename(req.file.originalname);const warnings=[],added=[];
   try{
    if(!materialTypes.includes(type))throw bad('请选择资料类别');
    const store=async(name,buffer,originalFile)=>{
     name=uploadFilename(name);
     const media=mediaExtensions.test(name);if(media&&type!=='课堂实录')throw bad('音视频请归入课堂实录');
     const sections=media?[]:await extractTeachingFile(buffer,name,type);const id=randomUUID(),file=path.join(data,'library',id+path.extname(name).toLowerCase());await fs.mkdir(path.dirname(file),{recursive:true});
     const d={id,owner,course_id:courseId,type,title:path.basename(name,path.extname(name)).slice(0,150),filename:name.slice(0,200),created:Date.now(),status:sections.length?'pending_review':'needs_text',sections,file,extraction_notice:sections.length?'文本已提取，请校订并确认入库':media?'音视频已保存，需补充转写文本后入库':'未提取到文字，可能为扫描件或图片课件，请补充文字后入库'};
     chunksFor(d);if(originalFile)await fs.rename(originalFile,file);else await fs.writeFile(file,buffer);try{persist(d);}catch(e){await fs.unlink(file).catch(()=>{});throw e;}added.push(summary(d));
    };
    if(/\.zip$/i.test(filename)){
     const buffer=await fs.readFile(req.file.path);if(buffer.length>20*MB)throw bad('ZIP资料包不得超过20MB');const files=boundedUnzip(buffer,{maxFiles:300,maxTotal:100*MB,maxFile:20*MB});const entries=Object.entries(files).filter(([n])=>!n.startsWith('__MACOSX/')&&!path.basename(n).startsWith('.'));
     if(entries.filter(([n])=>textExtensions.test(n)||mediaExtensions.test(n)).length>30)throw bad('资料包每次最多30份，请分批导入');
     for(const [name,b] of entries){if(!textExtensions.test(name)&&!mediaExtensions.test(name)){warnings.push(name+'：已跳过不支持的格式');continue;}try{await store(path.basename(name),Buffer.from(b));}catch(e){warnings.push(name+'：'+e.message);}}
     if(!added.length)throw bad('资料包中没有成功读取的资料：'+warnings.slice(0,2).join('；'));
    }else{if(!textExtensions.test(filename)&&!mediaExtensions.test(filename))throw bad('文件格式不受支持，请转换为DOCX/PPTX或上传文本');const buffer=mediaExtensions.test(filename)?null:await fs.readFile(req.file.path);await store(filename,buffer,req.file.path);}
    res.status(201).json({documents:added,warnings});
   }finally{await fs.unlink(req.file.path).catch(()=>{});}
  });
  app.get('/api/materials/:id',(req,res)=>{const {owner,courseId}=scope(req),d=own(req.params.id,owner,courseId);res.json({...summary(d),sections:d.sections});});
  app.patch('/api/materials/:id',teacher,(req,res)=>{
   const {owner,courseId}=scope(req),d=own(req.params.id,owner,courseId);
   if(req.body.text!==undefined){if(typeof req.body.text!=='string'||!req.body.text.trim())throw bad('请输入有效转写或校订文本');const text=limitText(anonymizeAssignment(d.type==='批改记录'?maskTable(req.body.text):req.body.text,typeIdentity(d)));d.sections=[{text,page:1,unit:'份校订文本'}];}
   if(req.body.reviewed===true){if(!d.sections.length)throw bad('请先补充文字内容');d.status='ready';d.reviewed_at=Date.now();d.extraction_notice='教师已校订并确认入库';chunksFor(d);}
   persist(d);res.json({...summary(d),sections:d.sections});
  });
  app.delete('/api/materials/:id',teacher,async(req,res)=>{const {owner,courseId}=scope(req),d=own(req.params.id,owner,courseId);const target=path.resolve(d.file),root=path.resolve(data,'library');if(path.dirname(target)!==root||!path.basename(target).startsWith(d.id+'.'))throw Error('资料路径校验失败');db.prepare('DELETE FROM teaching_materials WHERE id=? AND owner=? AND course_id=?').run(d.id,owner,courseId);await fs.unlink(target).catch(()=>{});res.json({ok:true});});
 }
 const typeIdentity=d=>d.type==='批改记录'?identityFrom(d.sections.map(s=>s.text).join('\n'),d.filename):{};
 return {catalogue,search:(owner,courseId,query,max)=>searchCatalogue(query,catalogue(owner,courseId),max),register,documents};
}
