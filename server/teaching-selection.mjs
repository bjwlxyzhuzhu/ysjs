export function candidateSegments(cuts,limit=20){
 if(limit<3||!Number.isInteger(limit))throw Error('候选数量上限至少为3');
 const boundaries=[...new Set(cuts.filter(Number.isFinite))].sort((a,b)=>a-b);
 if(boundaries.length<2||boundaries.at(-1)-boundaries[0]<.6)throw Error('视频过短，无法提供至少3个可分析片段，请上传不少于0.6秒的视频');
 const ranges=boundaries.slice(0,-1).map((start,i)=>({start,end:boundaries[i+1]}));
 while(ranges.length<3){let i=0;for(let j=1;j<ranges.length;j++)if(ranges[j].end-ranges[j].start>ranges[i].end-ranges[i].start)i=j;const {start,end}=ranges[i],middle=(start+end)/2;ranges.splice(i,1,{start,end:middle,continuous:true},{start:middle,end,continuous:true});}
 const segments=ranges.map((s,i)=>({...s,id:'c'+(i+1),time:(s.start+s.end)/2}));
 if(segments.length<=limit)return segments;
 return Array.from({length:limit},(_,i)=>segments[Math.round(i*(segments.length-1)/(limit-1))]);
}
export function validateSelection(raw,candidates,max=10,min=3){
 if(!Array.isArray(raw?.selected)||raw.selected.length<min||raw.selected.length>max)throw Error(`教学精选结果需为${min}至${max}项`);
 const seen=new Set();return raw.selected.map(s=>{
  const c=candidates.find(c=>c.id===s.id);
  if(!c||seen.has(s.id)||typeof s.reason!=='string'||!s.reason.trim()||s.reason.length>500)throw Error('教学精选缺少真实候选或教学理由');
  seen.add(s.id);return {...c,teaching_reason:s.reason};
 }).sort((a,b)=>a.start-b.start);
}
export function mergeTeachingSelection(protectedShots,selected,candidates){
 if(protectedShots.length>10)throw Error('教师已修改或复核的片段超过10个，已保留全部记录；请先整理这些片段再重新精选');
 const same=(a,b)=>Math.abs(a.start-b.start)<.01&&Math.abs(a.end-b.end)<.01;
 const preserved=protectedShots.map(s=>({start:s.start,end:s.end,time:(s.start+s.end)/2,teaching_reason:s.teaching_reason||'教师已复核或修改，优先保留'}));
 const result=[...preserved,...selected.filter(c=>!preserved.some(p=>same(p,c)))].slice(0,10);
 const remaining=candidates.filter(c=>!result.some(s=>same(s,c)));
 while(result.length<3&&remaining.length){
  let best=0,dist=-1;for(let i=0;i<remaining.length;i++){const d=result.length?Math.min(...result.map(s=>Math.abs(s.time-remaining[i].time))):remaining[i].time;if(d>dist){dist=d;best=i;}}
  const [candidate]=remaining.splice(best,1);result.push({...candidate,teaching_reason:candidate.continuous?'补充连续镜头内的教学观察区间，覆盖不同时间位置；不是新增剪辑边界，需独立图像标注与教师复核':'补充真实候选以覆盖更多叙事位置，需独立图像标注与教师复核'});
 }
 if(result.length<3)throw Error('真实候选不足3个，未标记精选完成，请重新识别');
 return result.sort((a,b)=>a.start-b.start);
}
