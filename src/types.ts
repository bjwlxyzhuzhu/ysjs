export type Page = '首页'|'拉片工作台'|'备课生成'|'作业批改'|'课程知识库'|'成效看板'|'学生成绩'|'账户安全';
export type User = {name:string;username?:string;role:'teacher'|'judge'|'admin';expires?:string};
export type Shot = {id:string;index:number;start:number;end:number;duration:number;keyframes:string[];shot_size:string;angle:string;movement:string;composition:string;lighting:string;sound:string[];av_relation:string;transition:string;function:string;knowledge_ids:string[];confidence:number;status:string;error?:string;teaching_reason?:string};
export type Clip = {id:string;title:string;duration:number;status:string;stage?:string;progress?:{phase:string;completed:number;total:number;success?:number;failed?:number;pending?:number};error?:string;analysis_complete?:boolean;reselect?:boolean;shots:Shot[];video_url?:string;created:number;active_seconds:number;baseline_minutes?:number;finished?:number};
export type Knowledge = {id:string;chapter:string;title:string;summary:string;excerpt:string;keywords:string[];references:number;source:{file:string;page:number};status:string};
export type SourceItem = {title:string;content:string;shot_ids:string[];knowledge_ids:string[];level?:string};
export type Lesson = {id:string;clip_id:string;clip_title:string;goal:string;reviewed:boolean;stale:boolean;shots:Shot[];content:{mode?:string;slides:SourceItem[];questions:SourceItem[];board:SourceItem;introduction:SourceItem}};
export type Grade = {created?:number;course?:string;term?:string;assignment_title?:string;id:string;reviewed:boolean;rubric:{name:string;weight:number}[];failures?:{student_id:string;student_name:string;filename:string;error:string}[];items:{id:string;student_id?:string;student_name?:string;filename?:string;teacher_comment?:string;text:string;total:number;dimensions:{name:string;score:number;reason:string}[];comments:{quote:string;comment:string}[];suggestion:string}[];common:{name:string;count:number;total:number}[]};
export type Stats = {teacher_reviewed?:number;updated_at?:string;clips:number;shots:number;annotated:number;questions:number;homework:number;efficiency:number|null;adoption:number|null;mean_score:number|null;records:(Omit<Clip,'shots'>&{shot_count:number;edits:number})[];distribution:{lower:number;count:number}[]};
export type Config = {provider:string;model:string;configured:boolean;verified:string|null;vision:boolean;text:boolean;local:boolean;options:Record<string,string[]>;rubric:{name:string;weight:number}[]};


export type LessonJob={progress?:number;id:string;clip_id:string;goal?:string;status:"queued"|"running"|"completed"|"failed";stage:string;created:number;error?:string;lesson?:Lesson};

export type Assignment={student_id:string;student_name:string;filename:string;text:string};
export type GradeJob={id:string;status:string;stage:string;created:number;completed?:number;total?:number;error?:string;grade?:Grade};
