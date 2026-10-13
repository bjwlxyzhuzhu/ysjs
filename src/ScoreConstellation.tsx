import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
type Dimension={name:string;score:number};
function Rings({dimensions,active,onSelect,moving}:{dimensions:Dimension[];active:number;onSelect:(i:number)=>void;moving:boolean}){
  const group=useRef<THREE.Group>(null),positions=useMemo(()=>dimensions.map((d,i)=>{const angle=Math.PI/2+i/dimensions.length*Math.PI*2,radius=.78+Math.max(0,Math.min(100,d.score))/100*.9;return new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,0);}),[dimensions]);
  const lines=useMemo(()=>positions.map(point=>new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),point]),new THREE.LineBasicMaterial({color:'#365e8b',transparent:true,opacity:.7}))),[positions]);
  useEffect(()=>()=>lines.forEach(line=>{line.geometry.dispose();line.material.dispose();}),[lines]);
  useFrame(({clock,pointer},delta)=>{if(!group.current||!moving)return;group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,pointer.x*.18,3,delta);group.current.rotation.x=THREE.MathUtils.damp(group.current.rotation.x,-pointer.y*.14,3,delta);group.current.position.y=Math.sin(clock.elapsedTime*.7)*.035;});
  return <group ref={group} rotation={[.08,-.12,0]}>
    {[.8,1.25,1.72].map((radius,i)=><mesh key={radius}><torusGeometry args={[radius,.012,8,80]}/><meshBasicMaterial color={i===2?'#5298c8':'#24466d'} transparent opacity={.65}/></mesh>)}
    <mesh><icosahedronGeometry args={[.34,1]}/><meshBasicMaterial color="#3f9dc4" wireframe transparent opacity={.85}/></mesh>
    <mesh rotation={[.2,.6,.1]}><torusGeometry args={[.5,.022,8,48]}/><meshBasicMaterial color="#6fe8d5"/></mesh>
    {lines.map((line,i)=><primitive key={i} object={line}/>)}
    {positions.map((point,i)=><group key={i} position={point}><mesh onClick={event=>{event.stopPropagation();onSelect(i);}}><sphereGeometry args={[active===i?.14:.1,16,12]}/><meshBasicMaterial color={active===i?'#e1fcff':'#68c1fb'}/></mesh>{active===i&&<mesh><sphereGeometry args={[.24,16,12]}/><meshBasicMaterial color="#559eff" transparent opacity={.16} depthWrite={false}/></mesh>}</group>)}
  </group>;
}
function ContextHealth({onLost}:{onLost:()=>void}){
  const gl=useThree(s=>s.gl);useEffect(()=>{const lost=(event:Event)=>{event.preventDefault();onLost();};gl.domElement.addEventListener('webglcontextlost',lost);return()=>gl.domElement.removeEventListener('webglcontextlost',lost);},[gl,onLost]);return null;
}
export default function ScoreConstellation({dimensions,active,onSelect,moving,onLost}:{dimensions:Dimension[];active:number;onSelect:(i:number)=>void;moving:boolean;onLost:()=>void}){
  return <Canvas frameloop={moving?'always':'demand'} dpr={[1,1.5]} camera={{position:[0,0,5.1],fov:48}} gl={{antialias:true,alpha:true}} fallback={<div className="score-visual-fallback">当前设备使用二维分项数据</div>}><ContextHealth onLost={onLost}/><Rings dimensions={dimensions} active={active} onSelect={onSelect} moving={moving}/></Canvas>;
}
