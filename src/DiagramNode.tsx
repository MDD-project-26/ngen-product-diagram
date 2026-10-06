import { memo } from 'react';
import { motion } from 'motion/react';
import type { DiagramNode as NodeData } from './data';
import { appFeatures, appNode } from './data';

export type InfoRequest = {node:NodeData;anchor:HTMLElement};
type Props = {node:NodeData;onInfo:(request:InfoRequest)=>void;onInfoLeave:()=>void;onInfoToggle:(request:InfoRequest)=>void;onFocusNode:(node:NodeData)=>void;activeInfo?:string};

export function Action({children,onClick,dark=false}:{children:React.ReactNode;onClick?:()=>void;dark?:boolean}) {
  return <motion.button type="button" className={'action'+(dark?' action-dark':'')} onClick={onClick} whileHover={{scale:1.035}} whileTap={{scale:0.98}} transition={{duration:0.2,ease:[0.22,1,0.36,1]}}>{children}<span className="material-symbol" aria-hidden="true">arrow_right_alt</span></motion.button>;
}

const ProductNode=memo(function ProductNode({node,onInfo,onInfoLeave,onInfoToggle,onFocusNode,activeInfo}:Props) {
  return <article className={'product-node node-'+node.variant+(node.cta?'':' node-no-cta')} data-node-id={node.figmaId} data-product={node.id} style={{left:node.x,top:node.y}} onFocus={()=>onFocusNode(node)}>
    <div className="node-image"><img src={'/assets/'+node.image+'.png'} alt="" draggable={false} style={node.crop}/></div>
    <div className="node-copy"><div><h2>{node.title}</h2><p>{node.description}</p></div>{node.cta?<Action dark={node.variant==='green'}>{node.cta}</Action>:null}</div>
    <button className="info-button" aria-label={'About '+node.title} aria-expanded={activeInfo===node.id} aria-describedby={activeInfo===node.id?'node-tooltip':undefined}
      onPointerEnter={e=>{if(e.pointerType==='mouse')onInfo({node,anchor:e.currentTarget});}} onPointerLeave={onInfoLeave}
      onFocus={e=>onInfo({node,anchor:e.currentTarget})} onBlur={onInfoLeave}
      onClick={e=>onInfoToggle({node,anchor:e.currentTarget})}><span className="material-symbol" aria-hidden="true">question_mark</span></button>
  </article>;
});
export default ProductNode;

export const AppCard=memo(function AppCard({onFocusNode}:{onFocusNode:(node:NodeData)=>void}) {
  return <article className="app-card" data-node-id={appNode.figmaId} data-product="app" style={{left:appNode.x,top:appNode.y}} onFocus={()=>onFocusNode(appNode)}>
    <div className="app-image"><img className="app-background" src="/assets/imgCardImage.png" alt="" draggable={false}/><div className="app-logo"><img src="/assets/imgScreenshot20260902At1941161.png" alt="" draggable={false}/></div></div>
    <div className="app-copy"><h2>SG Connect App</h2><div className="app-features">{[0,2,4].map(start=><div className="feature-row" key={start}><img className="feature-divider" src="/assets/imgLine7.svg" width={518} height={1} alt="" draggable={false}/>{appFeatures.slice(start,start+2).map(feature=><p key={feature}><span className="material-symbol" aria-hidden="true">check</span>{feature}</p>)}</div>)}<img className="last-divider" src="/assets/imgLine7.svg" width={518} height={1} alt="" draggable={false}/></div><Action>Explore SG Connect App</Action></div>
  </article>;
});
