import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {initializeCourses,assignedCourse,requireCourse,teacherCourses} from './courses.mjs';
const bad=message=>Object.assign(Error(message),{status:400});
export function passwordHash(password){if(typeof password!=='string'||password.length<8||password.length>128)throw bad('密码需为8至128个字符');const salt=randomBytes(16).toString('hex');return {salt,hash:scryptSync(password,salt,64).toString('hex')};}
export function passwordMatches(password,user){if(typeof password!=='string'||password.length>128)return false;const actual=scryptSync(password,user?.salt||'dummy',64);return !!user&&timingSafeEqual(actual,Buffer.from(user.hash,'hex'));}
export function publicUser(user,db){return {username:user.username,role:user.role,name:user.display_name||(user.role==='admin'?'系统管理员':user.role==='teacher'?'主讲教师':'评委体验'),expires:user.expires,...(db?{course:assignedCourse(db,user),courses:user.role==='teacher'?teacherCourses(db,user):[]}:{})};}
export function initializeAccounts(db){
 const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
 if(!columns.includes('display_name'))db.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
 if(!columns.includes('active'))db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
 initializeCourses(db);
}
export function initializeDeploymentAdmin(db,password=process.env.ADMIN_INITIAL_PASSWORD){
 if(db.prepare("SELECT username FROM users WHERE role='admin'").get())return {created:false,reason:'already_initialized'};
 if(password===undefined||password==='')return {created:false,reason:'not_configured'};
 if(db.prepare("SELECT username FROM users WHERE username='admin'").get())throw Error('账号admin已被占用，无法初始化管理员；请先解决账号冲突');
 let secret;try{secret=passwordHash(password);}catch{throw Error('ADMIN_INITIAL_PASSWORD需为8至128个字符；未创建管理员');}
 db.prepare('INSERT INTO users(username,role,salt,hash,expires,display_name,active) VALUES(?,?,?,?,?,?,1)').run('admin','admin',secret.salt,secret.hash,null,'系统管理员');
 return {created:true};
}
const local=req=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&['127.0.0.1','localhost'].includes(String(req.headers.host).split(':')[0])&&process.env.HOST!=='0.0.0.0';
export function registerAccountSetup(app,db,issue){
 app.get('/api/auth/setup',(req,res)=>res.json({required:!db.prepare("SELECT username FROM users WHERE role='admin'").get(),local:local(req)}));
 app.post('/api/auth/setup',(req,res)=>{
  if(!local(req))return res.status(403).json({error:'首次管理员设置仅可在本机完成'});
  if(db.prepare("SELECT username FROM users WHERE role='admin'").get())return res.status(409).json({error:'管理员已设置，请使用账号密码登录'});
  const {salt,hash}=passwordHash(req.body.password);if(db.prepare("SELECT username FROM users WHERE username='admin'").get())throw bad('账号admin已被使用，请先解决账号冲突');
  db.prepare('INSERT INTO users(username,role,salt,hash,expires,display_name,active) VALUES(?,?,?,?,?,?,1)').run('admin','admin',salt,hash,null,'系统管理员');issue(res,'admin');res.status(201).json(publicUser({username:'admin',role:'admin',display_name:'系统管理员'}));
 });
}
export function registerAccounts(app,db){
 const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'仅管理员可管理教师账号'});
 app.get('/api/admin/teachers',admin,(req,res)=>res.json(db.prepare("SELECT username,display_name,active,course_id FROM users WHERE role='teacher' ORDER BY username").all().map(t=>({...t,course:assignedCourse(db,t)}))));
 app.post('/api/admin/teachers',admin,(req,res)=>{
  const {username,name,password}=req.body;if(typeof username!=='string'||!/^[A-Za-z0-9_.-]{3,40}$/.test(username)||typeof name!=='string'||!name.trim()||name.length>60)throw bad('账号需为3至40位字母数字或_.-，姓名需为1至60字');
  if(db.prepare('SELECT username FROM users WHERE username=?').get(username))return res.status(409).json({error:'账号已存在'});
  const course=req.body.course_id?requireCourse(db,req.body.course_id):null;const {salt,hash}=passwordHash(password);db.prepare('INSERT INTO users(username,role,salt,hash,expires,display_name,active,course_id) VALUES(?,?,?,?,?,?,1,?)').run(username,'teacher',salt,hash,null,name.trim(),course?.id||'');if(course)db.prepare('INSERT OR IGNORE INTO teacher_courses VALUES(?,?)').run(username,course.id);res.status(201).json({username,display_name:name.trim(),active:1,course_id:course?.id||'',course});
 });
 app.patch('/api/admin/teachers/:username',admin,(req,res)=>{
  const user=db.prepare("SELECT username FROM users WHERE username=? AND role='teacher'").get(req.params.username);if(!user)return res.status(404).json({error:'教师账号不存在'});
  if(req.body.active!==undefined&&typeof req.body.active!=='boolean')throw bad('启用状态无效');
  let secret;if(req.body.password!==undefined)secret=passwordHash(req.body.password);
  const course=req.body.course_id===undefined?null:requireCourse(db,req.body.course_id);
  if(secret)db.prepare('UPDATE users SET salt=?,hash=? WHERE username=?').run(secret.salt,secret.hash,user.username);
  if(req.body.active!==undefined)db.prepare('UPDATE users SET active=? WHERE username=?').run(Number(req.body.active),user.username);
  if(course){db.prepare('UPDATE users SET course_id=? WHERE username=?').run(course.id,user.username);db.prepare('INSERT OR IGNORE INTO teacher_courses VALUES(?,?)').run(user.username,course.id);}
  if(secret||req.body.active===false||course)db.prepare('DELETE FROM sessions WHERE username=?').run(user.username);
  res.json({ok:true});
 });
 app.post('/api/auth/password',(req,res)=>{
  const user=db.prepare('SELECT * FROM users WHERE username=?').get(req.user.username);if(!passwordMatches(req.body.current_password,user))return res.status(400).json({error:'当前密码不正确'});
  const {salt,hash}=passwordHash(req.body.new_password);db.prepare('UPDATE users SET salt=?,hash=? WHERE username=?').run(salt,hash,user.username);db.prepare('DELETE FROM sessions WHERE username=?').run(user.username);res.clearCookie('lp_session');res.json({ok:true,message:'密码已更新，请重新登录'});
 });
}
