import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, type MotionValue } from 'motion/react';
import { nodes, type DiagramNode } from './data';
import ProductNode, { AppCard, type InfoRequest } from './DiagramNode';
import DesignLayers from './DesignLayers';
import { useCanvas, MIN_ZOOM, MAX_ZOOM } from './useCanvas';
import { useFullscreen } from './useFullscreen';
import './design-layers.css';

const tooltipTransition={duration:0.22,ease:[0.22,1,0.36,1] as [number,number,number,number]};

// Only the percentage subscribes to zoom frames; the diagram stays outside React updates.
function ZoomControls({scale,zoomAt,onInteract}:{scale:MotionValue<number>;zoomAt:ReturnType<typeof useCanvas>['zoomAt'];onInteract:()=>void}) {
  const [zoomState,setZoomState]=useState(()=>({zoom:Math.round(scale.get()*100),atMin:scale.get()<=MIN_ZOOM,atMax:scale.get()>=MAX_ZOOM}));
  const {zoom,atMin,atMax}=zoomState;
  useMotionValueEvent(scale,'change',value=>{
    const next={zoom:Math.round(value*100),atMin:value<=MIN_ZOOM,atMax:value>=MAX_ZOOM};
    setZoomState(previous=>previous.zoom===next.zoom&&previous.atMin===next.atMin&&previous.atMax===next.atMax?previous:next);
  });
  return <div className="zoom-controls" role="group" aria-label="Canvas zoom controls">
    <button className="zoom-value" data-node-id="6339:35482" aria-label={'Zoom '+zoom+' percent. Reset to 100 percent'} onClick={()=>{onInteract();zoomAt(1,undefined,true);}}>{zoom}%</button>
    <motion.button className="zoom-button" data-node-id="6339:35475" aria-label="Zoom out" disabled={atMin} onClick={()=>{onInteract();zoomAt(scale.get()/1.25,undefined,true);}} whileHover={{scale:1.035}} whileTap={{scale:0.98}}><span className="material-symbol" aria-hidden="true">remove</span></motion.button>
    <motion.button className="zoom-button" data-node-id="6338:35471" aria-label="Zoom in" disabled={atMax} onClick={()=>{onInteract();zoomAt(scale.get()*1.25,undefined,true);}} whileHover={{scale:1.035}} whileTap={{scale:0.98}}><span className="material-symbol" aria-hidden="true">add</span></motion.button>
  </div>;
}

function Tooltip({info,onEnter,onLeave}:{info:InfoRequest;onEnter:()=>void;onLeave:()=>void}) {
  // Animate position instead of a nested transform so zoomed text stays sharp.
  return <motion.div id="node-tooltip" role="tooltip" className="node-tooltip" data-canvas-controls style={{left:info.node.x+612}}
    initial={{opacity:0,top:info.node.y+8}} animate={{opacity:1,top:info.node.y}} exit={{opacity:0,top:info.node.y+8}} transition={tooltipTransition}
    onPointerEnter={onEnter} onPointerLeave={onLeave}>
    <h3>{info.node.title}</h3><p>{info.node.detail}</p>
  </motion.div>;
}

export default function App() {
  const canvas=useCanvas();
  const module=useRef<HTMLElement>(null);
  const frame=useRef<HTMLDivElement>(null);
  const fullscreen=useFullscreen(module,frame);
  const [info,setInfo]=useState<InfoRequest|null>(null);
  const pinned=useRef(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clearClose=useCallback(()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  const showInfo=useCallback((request:InfoRequest)=>{clearClose();if(!pinned.current)setInfo(request);},[clearClose]);
  const hideInfo=useCallback(()=>{clearClose();if(!pinned.current)closeTimer.current=setTimeout(()=>setInfo(null),120);},[clearClose]);
  const toggleInfo=useCallback((request:InfoRequest)=>{
    clearClose();
    if(pinned.current&&info?.node.id===request.node.id){pinned.current=false;setInfo(null);}
    else {pinned.current=true;setInfo(request);}
  },[clearClose,info]);
  const dismissInfo=useCallback(()=>{clearClose();pinned.current=false;setInfo(null);},[clearClose]);
  const focusNode=useCallback((node:DiagramNode)=>{
    if(document.activeElement?.matches(':focus-visible'))canvas.jumpTo(node);
  },[canvas.jumpTo]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){dismissInfo();}};
    const onPointer=(e:PointerEvent)=>{
      const target=e.target as Element;
      const movingCanvas=pinned.current&&target.closest('.canvas-viewport')&&!target.closest('button,[data-canvas-controls]');
      if(!target.closest('.info-button,.node-tooltip')&&!movingCanvas)dismissInfo();
    };
    document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPointer);
    return ()=>{clearClose();document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer);};
  },[dismissInfo,clearClose]);

  return <main ref={module} className="module">
    <motion.header className="module-header" animate={{opacity:fullscreen.active?0:1}} transition={{duration:0.25,ease:[0.22,1,0.36,1]}}><h1><span>How is NGEN’s</span><br/>SG Connect structured?</h1><p>How the aggregator operates the SG Connect product to turn distributed assets into tradable flexibility. Check any block for details.</p></motion.header>
    <div ref={frame} className="canvas-frame">
    <motion.div ref={canvas.viewport} style={fullscreen.style} className={'canvas-viewport'+(canvas.dragging?' is-dragging':'')+(fullscreen.expanded?' is-expanded':'')} tabIndex={0} role="region" aria-label="Interactive SG Connect product diagram" aria-describedby="canvas-instructions" {...canvas.handlers}>
      <div className="canvas-tag" data-canvas-controls><span className="material-symbol" aria-hidden="true">hub</span> Product diagram</div>
      <motion.button type="button" className="fullscreen-button" data-canvas-controls aria-label={fullscreen.active?'Exit full screen':'Enter full screen'} aria-pressed={fullscreen.active} disabled={fullscreen.busy} onClick={()=>{dismissInfo();void fullscreen.toggle();}} whileHover={{scale:1.035}} whileTap={{scale:0.98}} transition={{duration:0.2,ease:[0.22,1,0.36,1]}}>{fullscreen.active?'Exit fullscreen':'Fullscreen'}<span className="material-symbol" aria-hidden="true">{fullscreen.active?'fullscreen_exit':'fullscreen'}</span></motion.button>
      <motion.div className="diagram-pan" style={{left:canvas.x,top:canvas.y}}>
      {/* Keep one uniform scale, without a persistent compositing hint that caches a low-resolution surface. */}
      <motion.div className="diagram-world" style={{scale:canvas.scale}}>
        <DesignLayers/>
        {nodes.map(node=><ProductNode key={node.id} node={node} onInfo={showInfo} onInfoLeave={hideInfo} onInfoToggle={toggleInfo} onFocusNode={focusNode} activeInfo={info?.node.id}/>)}
        <AppCard onFocusNode={focusNode}/>
        <AnimatePresence>{info&&!canvas.dragging?<Tooltip key={info.node.id} info={info} onEnter={clearClose} onLeave={hideInfo}/>:null}</AnimatePresence>
      </motion.div>
      </motion.div>
      <div className="canvas-footer" data-canvas-controls>
        <div className="canvas-hint"><span id="canvas-instructions" data-node-id="6338:35455">Drag to pan <span aria-hidden="true">·</span> Ctrl + scroll to zoom</span></div>
        <ZoomControls scale={canvas.scale} zoomAt={canvas.zoomAt} onInteract={dismissInfo}/>
      </div>
    </motion.div>
    </div>
  </main>;
}
