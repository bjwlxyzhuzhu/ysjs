import {randomUUID} from 'node:crypto';
export const DEFAULT_COURSE='film-appreciation';
export function initializeCourses(db){
 db.exec("CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,label TEXT NOT NULL DEFAULT '')");
 db.prepare('INSERT OR IGNORE INTO courses VALUES(?,?,?)').run(DEFAULT_COURSE,'影视鉴赏','省级精品课程');
 const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
 if(!columns.includes('course_id'))db.exec("ALTER TABLE users ADD COLUMN course_id TEXT NOT NULL DEFAULT 'film-appreciation'");
}
export function assignedCourse(db,user){return db.prepare('SELECT * FROM courses WHERE id=?').get(user?.course_id||DEFAULT_COURSE)||db.prepare('SELECT * FROM courses WHERE id=?').get(DEFAULT_COURSE);}
export function requireCourse(db,id=DEFAULT_COURSE){const course=db.prepare('SELECT * FROM courses WHERE id=?').get(id);if(!course)throw Object.assign(Error('请选择有效课程'),{status:400});return course;}
export function registerCourses(app,db){
 app.get('/api/courses',(req,res)=>res.json(req.user.role==='admin'?db.prepare('SELECT * FROM courses ORDER BY rowid').all():[assignedCourse(db,req.user)]));
 app.post('/api/admin/courses',(req,res)=>{
  if(req.user.role!=='admin')return res.status(403).json({error:'仅管理员可添加课程'});
  const {name,label=''}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>60||typeof label!=='string'||label.length>60)throw Object.assign(Error('课程名称和简介需为不超过60字的文本'),{status:400});
  if(db.prepare('SELECT id FROM courses WHERE name=?').get(name.trim()))return res.status(409).json({error:'课程已存在，请直接选择'});
  const course={id:randomUUID(),name:name.trim(),label:label.trim()};db.prepare('INSERT INTO courses VALUES(?,?,?)').run(course.id,course.name,course.label);res.status(201).json(course);
 });
}
