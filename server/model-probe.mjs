import {deflateSync} from 'node:zlib';
const crc=b=>{let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=c>>>1^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),data.length+8);return out;};
export function visualProbeImage(){const w=256,h=128,header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*(w*3+1)+1+x*3;pixels[i]=x<w/2?255:0;pixels[i+2]=x>=w/2?255:0;}return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
export function parseModelJSON(content){
 const text=Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text||'').join('\n'):content;if(typeof text!=='string'||!text.trim())throw Error('empty');const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 if(clean.startsWith('['))throw Error('invalid');try{const obj=JSON.parse(clean);if(obj&&typeof obj==='object'&&!Array.isArray(obj))return obj;}catch{}
 // Extract complete final-answer JSON, never reasoning_content or guessed repairs.
 const start=clean.indexOf('{');if(start<0)throw Error('invalid');let depth=0,quoted=false,escaped=false;for(let i=start;i<clean.length;i++){const c=clean[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(clean.slice(start,i+1));}throw Error('invalid');
}
export function probeMatches(v){const color=x=>String(x||'').trim().toLowerCase().replace(/[\s。.!！]/g,'');return ['red','红','红色'].includes(color(v.left??v.left_color))&&['blue','蓝','蓝色'].includes(color(v.right??v.right_color));}
