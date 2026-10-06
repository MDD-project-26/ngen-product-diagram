import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { diagramBounds, type DiagramNode } from './data';

type Point = {x:number;y:number};
type View = Point & {scale:number};
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2;
export const WHEEL_ZOOM_SPEED = 0.012;
const WHEEL_PAN_SPEED = 1.15;
const WHEEL_SMOOTHING_MS = 28;
const clamp = (n:number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, n));
type TrackpadGestureEvent = Event & {scale:number;clientX:number;clientY:number};

export function useCanvas() {
  const viewport = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0), scale = useMotionValue(0.16);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useReducedMotion();
  const animations = useRef<ReturnType<typeof animate>[]>([]);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{view:View;center:Point;distance:number} | null>(null);
  const wheelFrame = useRef<number|null>(null);
  const wheelTarget = useRef<View|null>(null);
  const wheelTime = useRef<number|null>(null);

  const stop = useCallback(() => {
    animations.current.forEach(a => a.stop());animations.current=[];
    if(wheelFrame.current!==null)cancelAnimationFrame(wheelFrame.current);
    wheelFrame.current=null;wheelTarget.current=null;wheelTime.current=null;
  }, []);
  const currentView = useCallback(()=>({x:x.get(),y:y.get(),scale:scale.get()}),[x,y,scale]);
  const write = useCallback((next:View)=>{
    x.set(next.x);y.set(next.y);scale.set(next.scale);
  },[x,y,scale]);

  // One coherent camera update per frame. The OS already supplies scroll inertia;
  // this short, non-overshooting filter only smooths event timing and small steps.
  const followWheel = useCallback((next:View)=>{
    if(!wheelTarget.current){
      animations.current.forEach(a=>a.stop());animations.current=[];
    }
    wheelTarget.current=next;
    if(wheelFrame.current!==null)return;
    const tick=(time:number)=>{
      wheelFrame.current=null;
      const target=wheelTarget.current;if(!target)return;
      const current=currentView();
      const elapsed=wheelTime.current===null?1000/60:Math.min(64,time-wheelTime.current);
      wheelTime.current=time;
      const amount=reducedMotion?1:1-Math.exp(-elapsed/WHEEL_SMOOTHING_MS);
      const nextView={x:current.x+(target.x-current.x)*amount,y:current.y+(target.y-current.y)*amount,scale:current.scale+(target.scale-current.scale)*amount};
      if(Math.abs(target.x-nextView.x)<0.01&&Math.abs(target.y-nextView.y)<0.01&&Math.abs(target.scale-nextView.scale)<0.000001){
        write(target);wheelTarget.current=null;wheelTime.current=null;
      }else{
        write(nextView);wheelFrame.current=requestAnimationFrame(tick);
      }
    };
    wheelFrame.current=requestAnimationFrame(tick);
  },[currentView,reducedMotion,write]);
  const apply = useCallback((next:View, smooth=false) => {
    stop();
    if(smooth && !reducedMotion) {
      animations.current=[animate(x,next.x,{duration:0.35,ease:[0.22,1,0.36,1]}),animate(y,next.y,{duration:0.35,ease:[0.22,1,0.36,1]}),animate(scale,next.scale,{duration:0.35,ease:[0.22,1,0.36,1]})];
    } else {write(next);}
  },[x,y,scale,reducedMotion,stop,write]);

  const fit = useCallback((smooth=true) => {
    const el=viewport.current;if(!el)return;
    const {width,height}=el.getBoundingClientRect();
    const padding=width<600?26:72;
    const nextScale=clamp(Math.min((width-padding*2)/diagramBounds.width,(height-padding*2)/diagramBounds.height));
    apply({scale:nextScale,x:(width-diagramBounds.width*nextScale)/2-diagramBounds.x*nextScale,y:(height-diagramBounds.height*nextScale)/2-diagramBounds.y*nextScale},smooth);
  },[apply]);

  const zoomAt = useCallback((nextScale:number, point?:Point, smooth=false) => {
    const el=viewport.current;if(!el)return;
    const p=point??{x:el.clientWidth/2,y:el.clientHeight/2};
    const v={x:x.get(),y:y.get(),scale:scale.get()}, s=clamp(nextScale);
    apply({scale:s,x:p.x-(p.x-v.x)*s/v.scale,y:p.y-(p.y-v.y)*s/v.scale},smooth);
  },[apply,x,y,scale]);

  const jumpTo = useCallback((node:DiagramNode) => {
    const el=viewport.current;if(!el)return;
    const w=node.id==='app'?900:600,h=node.id==='app'?330:204;
    const s=clamp(Math.min((el.clientWidth-64)/(w+100),(el.clientHeight-150)/(h+180),0.9));
    apply({scale:s,x:el.clientWidth/2-(node.x+w/2)*s,y:el.clientHeight/2-(node.y+h/2)*s},true);
  },[apply]);

  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    fit(false);
    // Preserve the world point at the centre when the responsive module resizes.
    let previous={w:el.clientWidth,h:el.clientHeight};
    const observer=new ResizeObserver(()=>{
      const next={w:el.clientWidth,h:el.clientHeight};
      if(next.w===previous.w && next.h===previous.h)return;
      const current=currentView();
      apply({...current,x:current.x+(next.w-previous.w)/2,y:current.y+(next.h-previous.h)/2});
      previous=next;
    });
    observer.observe(el);
    let nativeGesture:{start:View;anchor:Point}|null=null;
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      if(nativeGesture||pointers.current.size)return;
      const current=wheelTarget.current??currentView();
      // deltaMode can be pixels, lines, or pages. Keep fractional trackpad input.
      const unitX=event.deltaMode===1?16:event.deltaMode===2?el.clientWidth:1;
      const unitY=event.deltaMode===1?16:event.deltaMode===2?el.clientHeight:1;
      const dx=event.deltaX*unitX,dy=event.deltaY*unitY;
      if(event.ctrlKey||event.metaKey){
        const rect=el.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};
        const nextScale=clamp(current.scale*Math.exp(-dy*WHEEL_ZOOM_SPEED));
        const ratio=nextScale/current.scale;
        followWheel({scale:nextScale,x:point.x-(point.x-current.x)*ratio,y:point.y-(point.y-current.y)*ratio});
      }else{
        const horizontal=event.shiftKey&&dx===0?dy:dx,vertical=event.shiftKey&&dx===0?0:dy;
        followWheel({...current,x:current.x-horizontal*WHEEL_PAN_SPEED,y:current.y-vertical*WHEEL_PAN_SPEED});
      }
    };
    // Safari sends native gesture events instead of Chromium's Ctrl-wheel pinch.
    const gestureStart=(event:Event)=>{
      event.preventDefault();if(pointers.current.size)return;
      stop();
      const e=event as TrackpadGestureEvent,rect=el.getBoundingClientRect();
      const point={x:Number.isFinite(e.clientX)?e.clientX-rect.left:rect.width/2,y:Number.isFinite(e.clientY)?e.clientY-rect.top:rect.height/2};
      const start=currentView();
      nativeGesture={start,anchor:{x:(point.x-start.x)/start.scale,y:(point.y-start.y)/start.scale}};
    };
    const gestureChange=(event:Event)=>{
      event.preventDefault();if(!nativeGesture)return;
      const e=event as TrackpadGestureEvent;if(!Number.isFinite(e.scale)||e.scale<=0)return;
      const rect=el.getBoundingClientRect();
      const point={x:Number.isFinite(e.clientX)?e.clientX-rect.left:rect.width/2,y:Number.isFinite(e.clientY)?e.clientY-rect.top:rect.height/2};
      const nextScale=clamp(nativeGesture.start.scale*e.scale);
      followWheel({scale:nextScale,x:point.x-nativeGesture.anchor.x*nextScale,y:point.y-nativeGesture.anchor.y*nextScale});
    };
    const gestureEnd=(event:Event)=>{event.preventDefault();nativeGesture=null;};
    el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('gesturestart',gestureStart,{passive:false});
    el.addEventListener('gesturechange',gestureChange,{passive:false});
    el.addEventListener('gestureend',gestureEnd,{passive:false});
    const interrupt=()=>{nativeGesture=null;stop();};
    window.addEventListener('blur',interrupt);
    return ()=>{observer.disconnect();el.removeEventListener('wheel',wheel);el.removeEventListener('gesturestart',gestureStart);el.removeEventListener('gesturechange',gestureChange);el.removeEventListener('gestureend',gestureEnd);window.removeEventListener('blur',interrupt);stop();};
  },[fit,apply,currentView,followWheel,stop]);

  function rebase() {
    const pts=[...pointers.current.values()];
    if(!pts.length){gesture.current=null;setDragging(false);return;}
    const center=pts.length===1?pts[0]:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
    const distance=pts.length===1?0:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);
    gesture.current={view:{x:x.get(),y:y.get(),scale:scale.get()},center,distance};
    setDragging(true);
  }
  function onPointerDown(e:ReactPointerEvent<HTMLDivElement>) {
    if(e.button!==0 || (e.target as Element).closest('button,a,select,[data-canvas-controls]'))return;
    stop();viewport.current?.focus({preventScroll:true});
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase();
  }
  function onPointerMove(e:ReactPointerEvent<HTMLDivElement>) {
    if(!pointers.current.has(e.pointerId)||!gesture.current)return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pts=[...pointers.current.values()],g=gesture.current;
    const center=pts.length===1?pts[0]:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
    let s=g.view.scale;
    if(pts.length>1 && g.distance>0)s=clamp(g.view.scale*Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)/g.distance);
    const r=e.currentTarget.getBoundingClientRect(),ratio=s/g.view.scale;
    apply({scale:s,x:center.x-r.left-(g.center.x-r.left-g.view.x)*ratio,y:center.y-r.top-(g.center.y-r.top-g.view.y)*ratio});
  }
  function onPointerUp(e:ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    rebase();
  }
  function onKeyDown(e:ReactKeyboardEvent<HTMLDivElement>) {
    if(e.target!==e.currentTarget)return;
    const v={x:x.get(),y:y.get(),scale:scale.get()},step=e.shiftKey?160:60;
    if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(v.scale*1.25,undefined,true);}
    else if(e.key==='-'){e.preventDefault();zoomAt(v.scale/1.25,undefined,true);}
    else if(e.key==='0'){e.preventDefault();fit();}
    else if(e.key.startsWith('Arrow')) {
      e.preventDefault();apply({...v,x:v.x+(e.key==='ArrowLeft'?step:e.key==='ArrowRight'?-step:0),y:v.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)},true);
    }
  }
  return {viewport,x,y,scale,dragging,fit,jumpTo,zoomAt,handlers:{onPointerDown,onPointerMove,onPointerUp,onPointerCancel:onPointerUp,onLostPointerCapture:onPointerUp,onKeyDown}};
}
