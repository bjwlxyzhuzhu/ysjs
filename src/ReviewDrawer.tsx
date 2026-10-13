import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X,PanelRightClose} from 'lucide-react';
import './review-ui.css';
export type ReviewTab={id:string;label:string;content:ReactNode};
export function ReviewDrawer({open,onClose,title,subtitle,tabs,initialTab,footer}:{open:boolean;onClose:()=>void;title:string;subtitle?:string;tabs:ReviewTab[];initialTab?:string;footer?:ReactNode}){
  const base=useId(),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),closeAction=useRef(onClose),[active,setActive]=useState(initialTab||tabs[0]?.id);
  closeAction.current=onClose;
  useEffect(()=>{if(open)setActive(initialTab||tabs[0]?.id);},[open,initialTab]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,root=document.getElementById('root'),oldInert=root?.inert,oldOverflow=document.body.style.overflow;
    if(root)root.inert=true;document.body.style.overflow='hidden';
    const frame=requestAnimationFrame(()=>closeButton.current?.focus());
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAction.current();return;}
      if(event.key!=='Tab')return;
      const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')||[]).filter(node=>node.getClientRects().length>0);
      if(!nodes.length){event.preventDefault();dialog.current?.focus();return;}
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown,true);if(root)root.inert=oldInert||false;document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus();};
  },[open]);
  if(!open)return null;
  const selected=tabs.find(t=>t.id===active)||tabs[0];
  return createPortal(<div className="review-layer">
    <div className="review-shade" aria-hidden="true" onClick={onClose}/>
    <div className="review-drawer" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={base+'-title'} aria-describedby={subtitle?base+'-subtitle':undefined} tabIndex={-1}>
      <header><div><span className="review-eyebrow"><PanelRightClose size={14}/>当前页评价工作台</span><h2 id={base+'-title'}>{title}</h2>{subtitle&&<p className="review-subtitle" id={base+'-subtitle'}>{subtitle.split(' · ').map((part,i)=><span key={i}>{part}</span>)}</p>}</div><button ref={closeButton} className="review-close" aria-label="关闭评价面板" onClick={onClose}><X size={20}/></button></header>
      <div className="review-tabs" role="tablist" aria-label="评价选项卡">{tabs.map((tab,index)=><button key={tab.id} id={base+'-tab-'+tab.id} role="tab" aria-selected={selected?.id===tab.id} aria-controls={base+'-panel-'+tab.id} tabIndex={selected?.id===tab.id?0:-1} onClick={()=>setActive(tab.id)} onKeyDown={event=>{
        if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        setActive(tabs[next].id);dialog.current?.querySelector<HTMLElement>('[id="'+base+'-tab-'+tabs[next].id+'"]')?.focus();
      }}>{tab.label}</button>)}</div>
      <section className="review-panel" id={base+'-panel-'+selected?.id} role="tabpanel" aria-labelledby={base+'-tab-'+selected?.id} tabIndex={0} key={selected?.id}>{selected?.content}</section>
      {footer&&<footer>{footer}</footer>}
    </div>
  </div>,document.body);
}
