import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

type Rect={left:number;top:number;width:number;height:number;radius:number};
// Slightly overdamped: soft settling without bouncing past the screen edges.
const fullscreenSpring={type:'spring' as const,stiffness:170,damping:28,mass:1};

export function useFullscreen(host:RefObject<HTMLElement|null>,frame:RefObject<HTMLDivElement|null>) {
  const [active,setActive]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [busy,setBusy]=useState(false);
  const activeRef=useRef(false),expandedRef=useRef(false),busyRef=useRef(false);
  const generation=useRef(0);
  const animations=useRef<ReturnType<typeof animate>[]>([]);
  const reducedMotion=useReducedMotion();
  const left=useMotionValue(0),top=useMotionValue(0),width=useMotionValue(0),height=useMotionValue(0),radius=useMotionValue(36);

  const stop=useCallback(()=>{animations.current.forEach(a=>a.stop());animations.current=[];},[]);
  const getOrigin=useCallback(()=>{
    const anchor=frame.current!;
    const rect=anchor.getBoundingClientRect();
    const corner=parseFloat(getComputedStyle(anchor).getPropertyValue('--canvas-radius'));
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,radius:corner};
  },[frame]);
  const transitionTo=useCallback((target:Rect,opening:boolean,id:number)=>{
    stop();
    const options=reducedMotion?{duration:0}:fullscreenSpring;
    animations.current=[animate(left,target.left,options),animate(top,target.top,options),animate(width,target.width,options),animate(height,target.height,options),animate(radius,target.radius,options)];
    void Promise.all(animations.current).then(()=>{
      if(id!==generation.current)return;
      animations.current=[];
      if(!opening){expandedRef.current=false;setExpanded(false);}
    });
  },[left,top,width,height,radius,reducedMotion,stop]);

  const close=useCallback(async()=>{
    if(!expandedRef.current)return;
    const id=++generation.current;
    activeRef.current=false;setActive(false);stop();
    busyRef.current=false;setBusy(false);
    if(document.fullscreenElement===host.current){
      busyRef.current=true;setBusy(true);
      try{await document.exitFullscreen();}catch{
        if(id===generation.current&&document.fullscreenElement===host.current){activeRef.current=true;setActive(true);}
      }
      if(id!==generation.current)return;
      busyRef.current=false;setBusy(false);
      if(activeRef.current)return;
    }
    if(id===generation.current&&frame.current)transitionTo(getOrigin(),false,id);
  },[host,frame,getOrigin,stop,transitionTo]);

  const toggle=useCallback(async()=>{
    if(busyRef.current)return;
    if(activeRef.current){await close();return;}
    if(!host.current||!frame.current)return;
    const id=++generation.current;
    stop();
    if(!expandedRef.current){
      const origin=getOrigin();
      // Start a fresh transition without inheriting velocity from initialization.
      left.jump(origin.left);top.jump(origin.top);width.jump(origin.width);height.jump(origin.height);radius.jump(origin.radius);
    }
    activeRef.current=true;expandedRef.current=true;
    setActive(true);setExpanded(true);busyRef.current=true;setBusy(true);
    try{
      // Request in the click gesture. Animating inside the host prevents the
      // browser's fullscreen promotion from snapping the canvas to its final size.
      if(!host.current.requestFullscreen)throw new Error('Fullscreen unavailable');
      await host.current.requestFullscreen();
    }catch{
      // Use the identical animation when an embedded preview denies the API.
    }
    if(id!==generation.current){
      if(!activeRef.current&&document.fullscreenElement===host.current)await document.exitFullscreen().catch(()=>{});
      return;
    }
    busyRef.current=false;setBusy(false);
    transitionTo({left:0,top:0,width:innerWidth,height:innerHeight,radius:0},true,id);
  },[host,frame,left,top,width,height,radius,getOrigin,stop,close,transitionTo]);

  useEffect(()=>{
    const changed=()=>{if(document.fullscreenElement!==host.current&&activeRef.current)void close();};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&activeRef.current)void close();};
    const resized=()=>{
      if(!expandedRef.current||busyRef.current)return;
      const id=++generation.current;
      if(activeRef.current)transitionTo({left:0,top:0,width:innerWidth,height:innerHeight,radius:0},true,id);
      else if(frame.current)transitionTo(getOrigin(),false,id);
    };
    document.addEventListener('fullscreenchange',changed);document.addEventListener('keydown',escape);window.addEventListener('resize',resized);
    return ()=>{document.removeEventListener('fullscreenchange',changed);document.removeEventListener('keydown',escape);window.removeEventListener('resize',resized);};
  },[host,frame,close,getOrigin,transitionTo]);
  useEffect(()=>{
    if(!expanded)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=previous;};
  },[expanded]);
  useEffect(()=>()=>{generation.current++;stop();},[stop]);

  // Explicit defaults also clear Motion's inline geometry when returning to flow.
  return {active,expanded,busy,toggle,style:expanded?{left,top,width,height,borderRadius:radius}:{left:0,top:0,width:'100%',height:'100%',borderRadius:'var(--canvas-radius)'}};
}
