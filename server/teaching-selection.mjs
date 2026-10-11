export function candidateSegments(cuts,limit=20){
 const segments=cuts.slice(0,-1).map((start,i)=>({id:'c'+(i+1),start,end:cuts[i+1],time:(start+cuts[i+1])/2}));
 if(segments.length<=limit)return segments;
 return Array.from({length:limit},(_,i)=>segments[Math.round(i*(segments.length-1)/(limit-1))]);
}
export function validateSelection(raw,candidates,max=10){
 if(!Array.isArray(raw.selected)||!raw.selected.length||raw.selected.length>max)throw Error('教学精选结果数量无效');
 const seen=new Set();return raw.selected.map(s=>{
  const c=candidates.find(c=>c.id===s.id);
  if(!c||seen.has(s.id)||typeof s.reason!=='string'||!s.reason.trim()||s.reason.length>500)throw Error('教学精选缺少真实候选或教学理由');
  seen.add(s.id);return {...c,teaching_reason:s.reason};
 }).sort((a,b)=>a.start-b.start);
}
