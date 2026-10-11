import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('.'),dir=path.join(root,'data','qa-'+Date.now()),port=8799,url='http://127.0.0.1:'+port;
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{windowsHide:true});let err='';p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(Error(err)));});}
test('真实媒体管线、复核限制、导出、数据隔离与未配置模型错误', {timeout:180000},async t=>{
 await fs.mkdir(dir,{recursive:true});const server=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,LP_LOCAL_DEMO:'true',PORT:String(port),LP_DATA_DIR:path.relative(root,dir),MODEL_API_KEY:'',VISION_API_KEY:'',TEXT_API_KEY:'',HOST:'127.0.0.1'},windowsHide:true});let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
 t.after(async()=>{server.kill();await new Promise(r=>server.once('exit',r));if(dir.startsWith(path.join(root,'data')+path.sep))await fs.rm(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){try{await fetch(url+'/api/me');break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.equal((await fetch(url+'/api/me')).status,401,output);
 const login=await fetch(url+'/api/auth/local',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const req=async(p,body,method='POST')=>{const r=await fetch(url+'/api'+p,{method:body?method:'GET',headers:{Cookie:cookie,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});return {status:r.status,data:await r.json()};};
 assert.equal((await req('/stats')).data.clips,0);assert.equal((await req('/knowledge')).data.length,171);
 const fixture=path.join(dir,'fixture.mp4');await run(process.env.FFMPEG_PATH||'ffmpeg',['-y','-f','lavfi','-i','color=c=red:s=320x180:d=1.5','-f','lavfi','-i','color=c=blue:s=320x180:d=1.5','-f','lavfi','-i','color=c=white:s=320x180:d=1.5','-filter_complex','[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]','-map','[v]','-c:v','libx264',fixture]);
 const form=()=>{const f=new FormData();f.set('file',new Blob([buffer]),'fixture.mp4');f.set('title','自动化验证片段');f.set('consent','true');return f;};const buffer=await fs.readFile(fixture);const upload=await req('/clips',form());assert.equal(upload.status,201);const id=upload.data.id;
 let clip;for(let i=0;i<300;i++){clip=(await req('/clips/'+id)).data;if(['review','error'].includes(clip.status))break;await new Promise(r=>setTimeout(r,150));}assert.equal(clip.status,'review',clip.error);assert.equal(clip.shots.length,3);assert.ok(clip.shots.every(s=>s.keyframes.length===3&&s.status==='manual_required'));
 const media=await fetch(url+clip.shots[0].keyframes[0],{headers:{Cookie:cookie}});assert.equal(media.status,200);assert.equal((await fetch(url+clip.video_url)).status,401);
 assert.equal(clip.selection.length,3);assert.equal(clip.selection_mode,'local_candidates');assert.equal(clip.analysis_complete,false);assert.match(clip.stage,/等待图像能力/);
 assert.equal((await req('/clips/'+id+'/chat',{question:''})).status,400);
 assert.equal((await req('/clips/'+id+'/chat',{question:'如何设计课堂导入？',history:[]})).status,503);
 assert.equal((await req('/clips/'+id+'/chat',{question:'分析',history:[{role:'system',content:'恶意角色'}]})).status,400);
 assert.equal((await req('/clips/'+id+'/generate',{mode:'template'})).status,409);
 assert.equal((await req('/shots/'+clip.shots[0].id+'/analyze',{})).status,503);
 assert.equal((await req('/shots/missing/analyze',{})).status,404);
 for(const s of clip.shots){assert.equal((await req('/shots/'+s.id,{...s,shot_size:'全景',function:'测试色块，无人物叙事证据',composition:'纯色画面',knowledge_ids:['t2.p04'],status:'teacher_reviewed'},'PATCH')).status,200);}
 assert.equal((await req('/shots/'+clip.shots[0].id+'/analyze',{})).status,409);
 await req('/clips/'+id+'/time',{seconds:10});const generated=await req('/clips/'+id+'/generate',{mode:'template'});assert.equal(generated.status,200);const lessonId=generated.data.id;assert.equal(generated.data.content.questions.length,5);
 assert.equal((await fetch(url+'/api/export/docx/'+lessonId,{headers:{Cookie:cookie}})).status,409);await req('/lessons/'+lessonId+'/review',{});
 const doc=await fetch(url+'/api/export/docx/'+lessonId,{headers:{Cookie:cookie}});assert.equal(doc.status,200);assert.equal(Buffer.from(await doc.arrayBuffer()).subarray(0,2).toString(),'PK');
 await req('/clips/'+id+'/baseline',{minutes:15},'PATCH');const stats=(await req('/stats')).data;assert.equal(stats.clips,1);assert.equal(stats.shots,3);assert.equal(stats.questions,5);assert.equal(stats.adoption,null);assert.equal(stats.efficiency,90);
 assert.equal((await req('/homework/grade',{texts:['近景强调人物表情。']})).status,400);
 assert.equal((await req('/homework/grade',{texts:[{}],consent:true})).status,400);
 assert.equal((await req('/homework/grade',{texts:['近景强调人物表情。'],consent:true})).status,503);
 const accounts=JSON.parse(await fs.readFile(path.join(dir,'initial-accounts.json'),'utf8'));const jl=await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'judge01',password:accounts.judge01})});const jc=jl.headers.get('set-cookie').split(';')[0];
 const judgeReq=async(p,b)=>fetch(url+'/api'+p,{method:b?'POST':'GET',headers:{Cookie:jc,...(b&&!(b instanceof FormData)?{'Content-Type':'application/json'}:{})},body:b?(b instanceof FormData?b:JSON.stringify(b)):undefined});assert.equal((await (await judgeReq('/clips')).json()).length,0);assert.equal((await judgeReq('/homework/grade',{texts:['作业']})).status,403);assert.equal((await judgeReq('/clips',form())).status,201);assert.equal((await judgeReq('/clips',form())).status,403);
 assert.equal((await judgeReq('/config/model',{model:'qwen3.8-max',key:'test-only-key'})).status,403);
 assert.equal((await judgeReq('/config/model/test',{})).status,403);
 assert.equal((await judgeReq('/shots/'+clip.shots[0].id+'/analyze',{})).status,403);
 // 等待评委上传的真实处理任务结束后再关闭，避免遗留 FFmpeg 子进程。
 for(let i=0;i<200;i++){const cs=await (await judgeReq('/clips')).json();if(['review','error'].includes(cs[0]?.status))break;await new Promise(r=>setTimeout(r,150));}
 await req('/shots/'+clip.shots[0].id,{...clip.shots[0],shot_size:'中景',function:'教师更新的分析',knowledge_ids:['t2.p04'],status:'teacher_reviewed'},'PATCH');assert.equal((await fetch(url+'/api/export/docx/'+lessonId,{headers:{Cookie:cookie}})).status,409);
 // 恢复待复核但中断的任务，保留第一镜教师编辑及ID，补齐缺失镜头。
 const {DatabaseSync}=await import('node:sqlite');const qaDb=new DatabaseSync(path.join(dir,'app.sqlite'));
 const before=(await req('/clips/'+id)).data;const row=qaDb.prepare('SELECT payload FROM records WHERE id=?').get(id);const partial=JSON.parse(row.payload);partial.shots=partial.shots.slice(0,1);partial.error='服务重启导致任务中断，请重试';partial.status='review';qaDb.prepare('UPDATE records SET payload=? WHERE id=?').run(JSON.stringify(partial),id);qaDb.close();
 assert.equal((await req('/clips/'+id+'/retry',{})).status,200);
 let resumed;for(let i=0;i<100;i++){resumed=(await req('/clips/'+id)).data;if(resumed.status==='review'&&resumed.shots.length===3&&!resumed.error)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(resumed.shots.length,3);assert.match(resumed.error,/图像能力/);assert.equal(resumed.shots[0].id,before.shots[0].id);assert.equal(resumed.shots[0].status,'teacher_reviewed');assert.equal(resumed.shots[0].function,'教师更新的分析');
 // 新教师工具只使用隔离测试数据，绝不删除用户真实短片。
 const {zipSync,strToU8}=await import('fflate');const hf=new FormData();hf.set('file',new Blob([zipSync({'20260001_张三.txt':strToU8('近景突出人物的情绪。')})]),'batch.zip');
 const imported=await req('/homework/import',hf);assert.equal(imported.status,200);assert.equal(imported.data.items[0].student_name,'张三');assert.equal((await judgeReq('/homework/import',hf)).status,403);
 assert.equal((await req('/homework/grade',{texts:{bad:true},consent:true})).status,400);
 const fixtureDb=new DatabaseSync(path.join(dir,'app.sqlite'));const owner=fixtureDb.prepare('SELECT owner FROM records WHERE id=?').get(id).owner;
 const rubric=(await req('/config')).data.rubric;const grade={id:'qa-grade',reviewed:false,items:[{id:'001',student_id:'002026001',student_name:'张三',filename:'作业.docx',text:'近景突出人物情绪。',total:80,dimensions:rubric.map(r=>({name:r.name,score:80,reason:'依据原文'})),comments:[{quote:'近景',comment:'需说明画面证据'}],suggestion:'结合具体镜头论证'}],rubric,common:[]};
 fixtureDb.prepare('INSERT INTO records (id,type,owner,payload) VALUES (?,?,?,?)').run(grade.id,'grade',owner,JSON.stringify(grade));fixtureDb.close();
 assert.equal((await fetch(url+'/api/export/csv/homework/qa-grade',{headers:{Cookie:cookie}})).status,409);
 assert.equal((await req('/homework/qa-grade',{reviewed:true},'PATCH')).status,200);
 const gcsv=await fetch(url+'/api/export/csv/homework/qa-grade',{headers:{Cookie:cookie}});const gtext=await gcsv.text();assert.equal(gcsv.status,200);for(const v of ['学号','姓名','评价意见','002026001','张三','80','需说明画面证据'])assert.ok(gtext.includes(v));
 const gdoc=await fetch(url+'/api/export/docx/qa-grade',{headers:{Cookie:cookie}});assert.equal(Buffer.from(await gdoc.arrayBuffer()).subarray(0,2).toString(),'PK');
 assert.equal((await fetch(url+'/api/clips/'+id,{method:'DELETE',headers:{Cookie:jc}})).status,403);
 assert.equal((await req('/clips/'+id,{},'DELETE')).status,200);assert.equal((await req('/clips/'+id)).status,404);assert.equal((await req('/lessons')).data.length,0);assert.equal((await req('/homework')).data[0].id,'qa-grade');await assert.rejects(fs.access(path.join(dir,'media',id)));
 const saved=await req('/config/model',{model:'qwen3.8-max',key:'test-only-key'});assert.equal(saved.status,200);assert.equal(JSON.stringify(saved.data).includes('test-only-key'),false);
 assert.equal((await req('/config/model',{model:'qwen3.8-max',key:''})).data.configured,true);
 assert.equal(JSON.stringify((await req('/config')).data).includes('test-only-key'),false);
});
