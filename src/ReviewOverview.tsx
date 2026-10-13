import {Component,lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,Pause,Play,Orbit} from 'lucide-react';
import {useReducedMotion} from './useMotionPreference';
import './review-ui.css';
const ScoreScene=lazy(()=>import('./ScoreConstellation'));
class VisualBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="score-visual-fallback">二维分项数据仍可查看</div>:this.props.children;}}
export function ReviewOverview({score,dimensions,active=0,status,title,onOpen,onDimension,paused=false}:{score:number|null;dimensions:{name:string;score:number}[];active?:number;status:string;title:string;onOpen:()=>void;onDimension:(i:number)=>void;paused?:boolean}){
  const root=useRef<HTMLDivElement>(null),reduced=useReducedMotion(),[stopped,setStopped]=useState(false),[inView,setInView]=useState(true),[visible,setVisible]=useState(document.visibilityState==='visible'),[lost,setLost]=useState(false);
  const safe=useMemo(()=>dimensions.filter(d=>Number.isFinite(d.score)).slice(0,5).map(d=>({...d,score:Math.max(0,Math.min(100,d.score))})),[dimensions]);
  const contextLost=useCallback(()=>setLost(true),[]);
  useEffect(()=>{const update=()=>setVisible(document.visibilityState==='visible');document.addEventListener('visibilitychange',update);const observer=new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??false));if(root.current)observer.observe(root.current);return()=>{document.removeEventListener('visibilitychange',update);observer.disconnect();};},[]);
  const moving=!reduced&&!stopped&&!paused&&inView&&visible;
  return <div className="review-overview" ref={root}>
    <div className="review-score-copy"><span className="review-eyebrow"><Orbit size={14}/>{title}</span><div className="review-score-number"><b>{score!==null&&Number.isFinite(score)?score:'—'}</b><small>/100</small></div><span className="review-status">{status}</span><button className="subtle" onClick={onOpen}>查看完整评价<ArrowUpRight size={15}/></button></div>
    <div className="review-score-visual"><div className="score-scene" aria-hidden="true">{safe.length&&!lost?<VisualBoundary><Suspense fallback={<div className="score-visual-fallback">正在呈现能力星环…</div>}><ScoreScene dimensions={safe} active={active} onSelect={onDimension} moving={moving} onLost={contextLost}/></Suspense></VisualBoundary>:<div className="score-visual-fallback">{lost?'二维分项数据仍可查看':'尚无已复核能力数据'}</div>}</div><button className="motion-toggle" aria-label={reduced?'系统已减少动效':stopped?'恢复能力星环动效':'暂停能力星环动效'} disabled={reduced} aria-pressed={stopped||reduced} onClick={()=>setStopped(v=>!v)}>{stopped||reduced?<Play size={12}/>:<Pause size={12}/>}<span>{reduced?'静态模式':stopped?'恢复动效':'暂停动效'}</span></button></div>
    {!!safe.length&&<div className="review-dimension-strip">{safe.map((d,i)=><button key={d.name} className={active===i?'active':''} onClick={()=>onDimension(i)} aria-label={'查看'+d.name+'评价'}><span>{d.name}</span><strong>{d.score}</strong><i style={{width:d.score+'%'}}/></button>)}</div>}
  </div>;
}
