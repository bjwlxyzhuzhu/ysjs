import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const source=process.argv[2];if(!source)throw Error('请提供课件目录');
await fs.mkdir('knowledge/source-text',{recursive:true});
const overview=[];
for(let i=1;i<=9;i++){
 const file=`专题${i}.pdf`;const task=getDocument({data:new Uint8Array(await fs.readFile(path.join(source,file))),cMapUrl:path.resolve('node_modules/pdfjs-dist/cmaps')+'/',cMapPacked:true,standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/',useSystemFonts:true,disableFontFace:true});const doc=await task.promise;
 const pages=[];for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();let text='',lastY;for(const item of content.items){if(!('str' in item))continue;if(lastY!==undefined&&Math.abs(item.transform[5]-lastY)>3)text+='\n';text+=item.str;lastY=item.transform[5];}pages.push({page:p,text});page.cleanup();}
 await fs.writeFile(`knowledge/source-text/topic-${i}.json`,JSON.stringify({file,pages},null,2));overview.push({file,pages:doc.numPages,characters:pages.reduce((n,p)=>n+p.text.length,0)});console.log(JSON.stringify({...overview.at(-1),samples:pages.slice(0,4)}));await task.destroy();
}
await fs.writeFile('knowledge/source-text/overview.json',JSON.stringify(overview,null,2));
