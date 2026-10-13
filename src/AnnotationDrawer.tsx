import {useEffect,useId,useRef,type ReactNode} from 'react';
import {PanelRightOpen,PanelRightClose,X} from 'lucide-react';

export function AnnotationDrawer({open,onOpen,onClose,index,dirty,children}:{open:boolean;onOpen:()=>void;onClose:()=>void;index?:number;dirty:boolean;children:ReactNode}){
  const id=useId(),panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null),closeAction=useRef(onClose);
  closeAction.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const current=document.activeElement;
    const previous=current instanceof HTMLElement&&current!==document.body&&!panel.current?.contains(current)?current:trigger.current;
    const frame=requestAnimationFrame(()=>close.current?.focus());
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&panel.current?.contains(document.activeElement)){event.preventDefault();closeAction.current();}};
    document.addEventListener('keydown',escape);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',escape);if(previous?.isConnected)previous.focus();};
  },[open]);
  return <>
    <button ref={trigger} className="annotation-edge" data-open={open} tabIndex={open?-1:0} aria-hidden={open} aria-label="展开镜头标注工作区" aria-controls={id} aria-expanded={open} onClick={onOpen}>
      <PanelRightOpen size={21}/><span>镜头标注</span><b>{index?'#'+String(index).padStart(2,'0'):'工作区'}</b>{dirty&&<i aria-label="有未保存标注"/>}
    </button>
    <aside ref={panel} id={id} className="annotation-drawer" data-open={open} role="dialog" aria-modal={false} aria-labelledby={id+'-title'} inert={!open} aria-hidden={!open}>
      <header className="annotation-drawer-head"><div><small><PanelRightClose size={15}/>镜析 · 标注与复核</small><h2 id={id+'-title'}>镜头标注工作区</h2><p>{dirty?'修改尚未保存 · 收起后继续保留':'可同时操作播放器与时间轴'}</p></div><button ref={close} className="annotation-close" aria-label="收起镜头标注工作区" onClick={onClose}><X size={20}/></button></header>
      <div className="annotation-drawer-body">{children}</div>
    </aside>
  </>;
}
