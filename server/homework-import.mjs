import path from 'node:path';
import { unzipSync } from 'fflate';
import mammoth from 'mammoth';
import { redact } from './domain.mjs';
const MB=1024*1024;
function bad(message){throw Object.assign(Error(message),{status:400});}
export function boundedUnzip(buffer,{maxFiles=200,maxTotal=40*MB,maxFile=8*MB}={}){
 let count=0,total=0;
 let files;try{files=unzipSync(new Uint8Array(buffer),{filter:entry=>{
  if(++count>maxFiles)bad('压缩包文件数量超限');
  const name=entry.name.replace(/\\/g,'/');
  if(name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.split('/').includes('..')||name.includes('\0'))bad('压缩包含不安全文件路径');
  total+=entry.originalSize;
  if(entry.originalSize>maxFile||total>maxTotal)bad('压缩包解压大小超限');
  return !name.endsWith('/');
 }});}catch(e){if(e.status===400)throw e;bad('压缩包损坏、加密或格式不受支持');}
 let actual=0;for(const b of Object.values(files)){actual+=b.length;if(b.length>maxFile||actual>maxTotal)bad('压缩包实际解压大小超限');}return files;
}
export function identityFrom(text,filename=''){
 const base=path.basename(filename.replace(/\\/g,'/')).replace(/\.[^.]+$/,'');
 let student_id=text.match(/(?:学号|学生编号)\s*[:：]\s*([A-Za-z0-9-]{3,30})/)?.[1]||'';
 let student_name=text.match(/(?:学生姓名|姓名)\s*[:：]\s*([^\s，,；;：:]{1,30})/)?.[1]||'';
 const leading=base.match(/^(\d{5,30})[_\s-]+([^_\s-]{1,30})/),trailing=base.match(/^([^_\s-]{1,30})[_\s-]+(\d{5,30})$/);
 if(leading){student_id ||= leading[1];student_name ||= leading[2];}else if(trailing){student_name ||= trailing[1];student_id ||= trailing[2];}
 return {student_id,student_name};
}
export function anonymizeAssignment(text,identity={}){
 let clean=redact(text);
 for(const value of [identity.student_id,identity.student_name])if(value)clean=clean.split(value).join('[身份已移除]');
 return clean;
}
async function parseFile(buffer,filename){
 const ext=path.extname(filename).toLowerCase();let text;
 if(ext==='.docx'){boundedUnzip(buffer,{maxFiles:300,maxTotal:32*MB,maxFile:8*MB});text=(await mammoth.extractRawText({buffer:Buffer.from(buffer)})).value;}
 else if(ext==='.txt')text=Buffer.from(buffer).toString('utf8');else bad('仅支持 DOCX、UTF-8 TXT 和 ZIP；旧版DOC请另存为DOCX');
 if(!text.trim()||text.length>20000)bad('单份作业需为1至20000字');
 const identity=identityFrom(text,filename);return {...identity,filename,text:anonymizeAssignment(text,identity)};
}
export async function importHomework(buffer,filename){
 if(buffer.length>20*MB)bad('上传文件不得超过20MB');
 if(!filename.toLowerCase().endsWith('.zip')){const item=await parseFile(buffer,filename);return {text:item.text,items:[item],warnings:[]};}
 const files=boundedUnzip(buffer),items=[],warnings=[];
 const entries=Object.entries(files).filter(([n])=>!n.startsWith('__MACOSX/')&&!path.basename(n).startsWith('.'));
 const supported=entries.filter(([n])=>/\.(docx|txt)$/i.test(n));
 if(!supported.length)bad('ZIP内没有可读取的DOCX或TXT作业；旧版DOC需先转换');
 if(supported.length>30)bad('每批最多30份作业，请拆分压缩包');
 for(const [n,b] of supported){try{items.push(await parseFile(b,n));}catch(e){warnings.push(n+'：'+e.message);}}
 for(const [n] of entries)if(!/\.(docx|txt)$/i.test(n))warnings.push(n+'：已跳过不支持的文件类型');
 if(!items.length)bad('压缩包中的作业均未能读取：'+warnings.slice(0,2).join('；'));
 return {items,warnings,text:items.map(x=>x.text).join('\n---\n')};
}
