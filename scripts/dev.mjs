import { spawn } from 'node:child_process';
// 后端任务可能持续数分钟，开发热重启会中断模型请求。前端仍由Vite热更新。
const children = [spawn(process.execPath, ['server/index.mjs'], {stdio:'inherit',windowsHide:true}), spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {stdio:'inherit',windowsHide:true})];
let stopping=false;
function stop(){if(stopping)return;stopping=true;children.forEach(c=>c.kill());}
children.forEach(c=>c.on('exit',stop)); process.on('SIGINT',stop); process.on('SIGTERM',stop);
