import type { CSSProperties } from 'react';

export type DiagramNode = {
  id: string; figmaId: string; title: string; description: string;
  x: number; y: number; variant: 'white' | 'green' | 'dark';
  image: string; crop: CSSProperties; cta?: string; detail: string;
};
const crop = (width: string, height: string, left: string, top: string): CSSProperties => ({ width, height, left, top });
export const nodes: DiagramNode[] = [
  {id:'markets',figmaId:'6327:24664',title:'Electricity markets',description:'Intraday · aFRR · mFRR',x:800,y:600,variant:'white',image:'imgImge1',crop:crop('195.79%','100%','-53%','0'),detail:'SG Connect connects distributed flexibility to electricity markets. The aggregator chooses the market and coordinates activation across the virtual power plant.'},
  {id:'aggregator',figmaId:'6317:24563',title:'Aggregator',description:'Operates the platform, manages activations & trading',x:2190,y:600,variant:'dark',image:'imgImge5',crop:crop('215.56%','124.04%','-57.78%','-8.01%'),cta:'Explore',detail:'The aggregator operates the platform, manages activations and trading, and selects the electricity market. Activation signals go to the virtual power plant; metering, billing and rewards connect to Supply / Offtake.'},
  {id:'vpp',figmaId:'6256:25508',title:'SG Connect Flexibility (VPP)',description:'the pool acts as one power plant',x:2190,y:1324,variant:'green',image:'imgImge1',crop:crop('195.79%','100%','-53%','0'),detail:'A virtual power plant pools distributed assets so they can act as one power plant. Activation signals from the aggregator are translated into control, with live data returning from the SG Connect App.'},
  {id:'brain',figmaId:'6225:24589',title:'SG Brain',description:'Optimisation every 15 minutes',x:800,y:2111,variant:'green',image:'imgImge4',crop:crop('235.93%','145.56%','-67.97%','-23.89%'),cta:'Explore',detail:'SG Brain uses live data, weather and electricity prices to optimise every 15 minutes. Its optimal plan feeds into the SG Connect App.'},
  {id:'supply',figmaId:'6317:24582',title:'Supply / Offtake',description:'Contract · Dynamic Pricing · Billing · Settlement of Rewards',x:3580,y:2111,variant:'white',image:'imgImge',crop:crop('440%','253.19%','-170%','-72.75%'),cta:'Explore',detail:'Supply / Offtake connects contracts, dynamic pricing, billing and settlement of rewards. It provides electricity prices to the app and connects the home or business to metering, billing and rewards for activation.'},
  {id:'synaptic',figmaId:'6317:24598',title:'Synaptic',description:'On-site device (HW) - Control & Live data pass through here',x:2190,y:2898,variant:'white',image:'imgImge2',crop:crop('100%','100%','0','0'),cta:'Explore',detail:'Synaptic is the on-site hardware device. Dispatch and control pass through it to connected assets, while live data and aggregated power return to the SG Connect App.'},
  {id:'home',figmaId:'6327:24682',title:'Your Home or Business',description:'Operates the platform, manages activations & trading',x:2190,y:3622,variant:'white',image:'imgImge3',crop:crop('142.15%','82.15%','-14.93%','8.93%'),cta:'Explore',detail:'Your home or business connects EV chargers, solar PV, inverters and batteries through Synaptic. The diagram links these assets to the supply / offtake contract and rewards for activation.'},
];
export const appNode: DiagramNode = {id:'app',figmaId:'6256:25233',title:'SG Connect App',description:'Live data, alerts, electricity prices and peak shaving.',x:2040,y:2048,variant:'white',image:'imgScreenshot20260902At1941161',crop:{},cta:'Explore SG Connect App',detail:'The SG Connect App brings together live data, alerts, your electricity prices, peak shaving, time-based control and devices. It connects the optimal plan from SG Brain to dispatch through Synaptic.'};
export const appFeatures = ['Live data','Alerts','My electricity prices','Peak shaving','Time-based control','Devices'];
export const diagramBounds = { x: 720, y: 510, width: 3540, height: 3560 };
