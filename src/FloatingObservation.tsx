import {useCallback,useEffect,useId,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import {Grip,RotateCcw,X,MessageSquare,ChevronDown,ChevronUp} from 'lucide-react';
import type {Shot} from './types';

type Point={x:number;y:number};
type Bounds={minX:number;maxX:number;minY:number;maxY:number};
const clamp=(p:Point,b:Bounds)=>({x:Math.max(b.minX,Math.min(b.maxX,p.x)),y:Math.max(b.minY,Math.min(b.maxY,p.y))});

export function FloatingObservation({shot}:{shot:Shot|null}){
  const card=useRef<HTMLElement>(null),position=useRef<Point>({x:12,y:60}),bounds=useRef<Bounds>({minX:12,maxX:12,minY:58,maxY:58}),initialized=useRef(false),drag=useRef<{id:number;start:Point;origin:Point}|null>(null),frame=useRef<number|null>(null),id=useId();
  const [point,setPoint]=useState(position.current),[hidden,setHidden]=useState(false),[collapsed,setCollapsed]=useState(false),[moving,setMoving]=useState(false);
  const place=useCallback((next:Point)=>{position.current=clamp(next,bounds.current);setPoint(position.current);},[]);
  const measure=useCallback(()=>{
    const node=card.current,container=node?.parentElement;if(!node||!container)return;
    bounds.current={minX:12,maxX:Math.max(12,container.clientWidth-node.offsetWidth-12),minY:58,maxY:Math.max(58,container.clientHeight-node.offsetHeight-38)};
    if(!initialized.current){initialized.current=true;place({x:12,y:bounds.current.maxY});}else place(position.current);
  },[place]);
  useEffect(()=>{
    if(hidden)return;
    measure();const observer=new ResizeObserver(measure);if(card.current){observer.observe(card.current);if(card.current.parentElement)observer.observe(card.current.parentElement);}
    return()=>{observer.disconnect();if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;};
  },[hidden,measure]);
  const reset=()=>{measure();place({x:12,y:bounds.current.maxY});};
  const start=(event:PointerEvent<HTMLButtonElement>)=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();measure();drag.current={id:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:position.current};event.currentTarget.setPointerCapture(event.pointerId);setMoving(true);
  };
  const move=(event:PointerEvent<HTMLButtonElement>)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();position.current=clamp({x:current.origin.x+event.clientX-current.start.x,y:current.origin.y+event.clientY-current.start.y},bounds.current);
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;setPoint(position.current);});
  };
  const end=(event:PointerEvent<HTMLButtonElement>)=>{if(drag.current?.id!==event.pointerId)return;drag.current=null;setMoving(false);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
  const keyboard=(event:KeyboardEvent<HTMLButtonElement>)=>{
    const delta=event.shiftKey?30:10,keys:Record<string,Point>={ArrowLeft:{x:-delta,y:0},ArrowRight:{x:delta,y:0},ArrowUp:{x:0,y:-delta},ArrowDown:{x:0,y:delta}};
    if(event.key==='Home'){event.preventDefault();reset();}else if(keys[event.key]){event.preventDefault();measure();place({x:position.current.x+keys[event.key].x,y:position.current.y+keys[event.key].y});}
  };
  if(hidden)return <button className="observation-restore" onClick={()=>setHidden(false)}><MessageSquare size={16}/>显示镜头观察</button>;
  return <section ref={card} className="floating-observation" data-dragging={moving} aria-label="镜头观察分析" style={{transform:`translate3d(${point.x}px,${point.y}px,0)`}}>
    <header><button className="observation-grip" aria-label="拖动镜头观察面板" aria-describedby={id} title="拖动调整位置；方向键移动，Home还原" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null;setMoving(false);}} onKeyDown={keyboard}><Grip size={16}/><span>镜头观察</span></button><div><button aria-label="还原观察面板位置" title="还原位置" onClick={reset}><RotateCcw size={14}/></button><button aria-label={collapsed?'展开镜头观察':'收起镜头观察'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<ChevronDown size={14}/>:<ChevronUp size={14}/>}</button><button aria-label="隐藏镜头观察" onClick={()=>setHidden(true)}><X size={14}/></button></div></header>
    <span className="sr-only" id={id}>按住拖动；方向键移动，Shift加速，Home还原位置。面板不会移出影厅。</span>
    {!collapsed&&<div className="observation-copy"><small>{shot?.status==='teacher_reviewed'?'教师复核解读':shot?.status==='ai_draft'?'AI 初稿 · 待复核':'拖动标题，调整位置'}</small><p>{shot&&shot.function!=='无法判断'?shot.function:'选择镜头查看观察解读，也可隐藏此面板专注银幕。'}</p></div>}
  </section>;
}
