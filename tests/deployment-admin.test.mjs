import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {initializeAccounts,initializeDeploymentAdmin,passwordHash,passwordMatches} from '../server/accounts.mjs';
function fixture(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(username TEXT PRIMARY KEY,role TEXT,salt TEXT,hash TEXT,expires TEXT); CREATE TABLE records(id TEXT PRIMARY KEY,payload TEXT);');initializeAccounts(db);return db;}
test('部署管理员只在首次创建，保存加盐哈希，不覆盖现有账号或教学数据',()=>{
 const db=fixture();try{
  const original=passwordHash('fixture-teacher-password');db.prepare('INSERT INTO users(username,role,salt,hash) VALUES(?,?,?,?)').run('teacher','teacher',original.salt,original.hash);db.exec("INSERT INTO records VALUES('grade-1','preserved')");
  assert.deepEqual(initializeDeploymentAdmin(db,''),{created:false,reason:'not_configured'});
  assert.throws(()=>initializeDeploymentAdmin(db,'short'),/8至128/);assert.equal(db.prepare("SELECT count(*) AS count FROM users WHERE role='admin'").get().count,0);
  assert.deepEqual(initializeDeploymentAdmin(db,'fixture-deployment-admin'),{created:true});
  const admin=db.prepare("SELECT * FROM users WHERE username='admin'").get();assert.equal(admin.role,'admin');assert.equal(admin.active,1);assert.notEqual(admin.hash,'fixture-deployment-admin');assert(passwordMatches('fixture-deployment-admin',admin));
  assert.deepEqual(initializeDeploymentAdmin(db,'different-password'),{created:false,reason:'already_initialized'});assert.deepEqual(db.prepare("SELECT * FROM users WHERE username='admin'").get(),admin);
  assert.equal(db.prepare("SELECT hash FROM users WHERE username='teacher'").get().hash,original.hash);assert.equal(db.prepare('SELECT payload FROM records').get().payload,'preserved');
 }finally{db.close();}
});
test('部署初始化遇到admin账号冲突时不提权、不覆盖密码',()=>{
 const db=fixture();try{const original=passwordHash('fixture-teacher-password');db.prepare('INSERT INTO users(username,role,salt,hash) VALUES(?,?,?,?)').run('admin','teacher',original.salt,original.hash);assert.throws(()=>initializeDeploymentAdmin(db,'fixture-deployment-admin'),/占用/);const user=db.prepare("SELECT * FROM users WHERE username='admin'").get();assert.equal(user.role,'teacher');assert.equal(user.hash,original.hash);}finally{db.close();}
});
test('容器监听模式通过环境初始化，公网设置仍被拒绝，重启不改变密码', {timeout:30000},async()=>{
 const root=path.resolve('.'),dir=path.join(root,'data','deployment-admin-qa-'+Date.now()),url='http://127.0.0.1:8804';await fs.mkdir(dir,{recursive:true});let server,logs='';
 async function start(password){server=spawn(process.execPath,['server/index.mjs'],{cwd:root,windowsHide:true,env:{...process.env,HOST:'0.0.0.0',PORT:'8804',LP_DATA_DIR:path.relative(root,dir),ADMIN_INITIAL_PASSWORD:password,LP_LOCAL_DEMO:'false',MODEL_API_KEY:''}});server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);for(let i=0;i<100;i++){try{await fetch(url+'/api/auth/setup');return;}catch{await new Promise(r=>setTimeout(r,50));}}throw Error('隔离部署服务启动失败');}
 async function stop(){if(!server||server.exitCode!==null)return;const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
 async function login(password){const r=await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password})});return {status:r.status,data:await r.json()};}
 try{
  await start('fixture-deployed-admin-password');assert.deepEqual(await(await fetch(url+'/api/auth/setup')).json(),{required:false,local:false});
  assert.equal((await fetch(url+'/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'unauthorized-password'})})).status,403);
  const initial=JSON.parse(await fs.readFile(path.join(dir,'initial-accounts.json'),'utf8'));assert(initial.teacher&&initial.judge01);assert.equal(initial.admin,undefined);assert(!JSON.stringify(initial).includes('fixture-deployed-admin-password'));
  const result=await login('fixture-deployed-admin-password');assert.equal(result.status,200);assert.equal(result.data.role,'admin');assert(!JSON.stringify(result.data).includes('hash'));
  await stop();await start('fixture-different-password');assert.equal((await login('fixture-deployed-admin-password')).status,200);assert.equal((await login('fixture-different-password')).status,401);assert(!logs.includes('fixture-deployed-admin-password'));assert(!logs.includes('fixture-different-password'));
 }finally{await stop();if(path.resolve(dir).startsWith(path.resolve(root,'data')+path.sep))await fs.rm(dir,{recursive:true,force:true});}
});
