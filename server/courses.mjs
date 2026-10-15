import {randomUUID} from 'node:crypto';
export const DEFAULT_COURSE='film-appreciation';
export function initializeCourses(db){
 db.exec("CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,label TEXT NOT NULL DEFAULT '')");
 db.prepare('INSERT OR IGNORE INTO courses VALUES(?,?,?)').run(DEFAULT_COURSE,'影视鉴赏','省级精品课程');
 const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
 if(!columns.includes('course_id'))db.exec("ALTER TABLE users ADD COLUMN course_id TEXT NOT NULL DEFAULT 'film-appreciation'");
 db.exec('CREATE TABLE IF NOT EXISTS teacher_courses(username TEXT NOT NULL,course_id TEXT NOT NULL,PRIMARY KEY(username,course_id))');
 db.exec("INSERT OR IGNORE INTO teacher_courses SELECT username,course_id FROM users WHERE role='teacher' AND course_id!='' AND NOT EXISTS(SELECT 1 FROM teacher_courses t WHERE t.username=users.username)");
}
export function assignedCourse(db,user){return db.prepare('SELECT * FROM courses WHERE id=?').get(user?.course_id===undefined?DEFAULT_COURSE:user.course_id)||null;}
export function teacherCourses(db,user){return db.prepare('SELECT c.* FROM courses c JOIN teacher_courses t ON t.course_id=c.id WHERE t.username=? ORDER BY c.rowid').all(user.username);}
export function requireCourse(db,id=DEFAULT_COURSE){const course=db.prepare('SELECT * FROM courses WHERE id=?').get(id);if(!course)throw Object.assign(Error('请选择有效课程'),{status:400});return course;}
export function registerCourses(app,db,{busy=()=>false}={}){
 app.get('/api/courses',(req,res)=>res.json(req.user.role==='admin'?db.prepare('SELECT * FROM courses ORDER BY rowid').all():req.user.role==='teacher'?teacherCourses(db,req.user):[assignedCourse(db,req.user)].filter(Boolean)));
 app.post('/api/courses',(req,res)=>{
  if(req.user.role!=='teacher')return res.status(403).json({error:'仅教师可添加自己的课程'});
  const {name,label=''}=req.body;
  if(typeof name!=='string'||!name.trim()||name.trim().length>60||typeof label!=='string'||label.length>60)return res.status(400).json({error:'课程名称和简介需为不超过60字的文本'});
  let course=db.prepare('SELECT * FROM courses WHERE name=?').get(name.trim());
  if(!course){course={id:randomUUID(),name:name.trim(),label:label.trim()};db.prepare('INSERT INTO courses VALUES(?,?,?)').run(course.id,course.name,course.label);}
  db.prepare('INSERT OR IGNORE INTO teacher_courses VALUES(?,?)').run(req.user.username,course.id);res.status(201).json(course);
 });
 app.post('/api/courses/:id/select',(req,res)=>{
  if(req.user.role!=='teacher')return res.status(403).json({error:'仅教师可切换课程'});
  const course=teacherCourses(db,req.user).find(c=>c.id===req.params.id);if(!course)return res.status(403).json({error:'请先添加自己的课程'});
  const active=db.prepare("SELECT payload FROM records WHERE owner=? AND type IN ('clip','lesson_job','grade_job')").all(req.user.username).some(r=>['queued','running','processing'].includes(JSON.parse(r.payload).status));
  if(active||busy(req.user.username))return res.status(409).json({error:'分析、备课或批改正在执行，请停止或等待完成后切换课程'});
  db.prepare('UPDATE users SET course_id=? WHERE username=?').run(course.id,req.user.username);res.json({course});
 });
 app.post('/api/admin/courses',(req,res)=>{
  if(req.user.role!=='admin')return res.status(403).json({error:'仅管理员可添加课程'});
  const {name,label=''}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>60||typeof label!=='string'||label.length>60)throw Object.assign(Error('课程名称和简介需为不超过60字的文本'),{status:400});
  if(db.prepare('SELECT id FROM courses WHERE name=?').get(name.trim()))return res.status(409).json({error:'课程已存在，请直接选择'});
  const course={id:randomUUID(),name:name.trim(),label:label.trim()};db.prepare('INSERT INTO courses VALUES(?,?,?)').run(course.id,course.name,course.label);res.status(201).json(course);
 });
}
