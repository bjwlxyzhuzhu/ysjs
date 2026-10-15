let workspaceCourse='';
export function setWorkspaceCourse(id:string){workspaceCourse=id;}
export async function api<T>(url:string,body?:unknown,method?:string):Promise<T>{
 const form=body instanceof FormData;
 const r=await fetch('/api'+url,{signal:AbortSignal.timeout(240000),method:method||(body?'POST':'GET'),headers:{...(body&&!form?{'Content-Type':'application/json'}:{}),...(workspaceCourse&&!url.startsWith('/courses')&&!url.startsWith('/auth')&&url!=='/me'?{'X-Workspace-Course':workspaceCourse}:{})},body:body?(form?body:JSON.stringify(body)):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'请求失败');return data;
}
export const timecode=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;
