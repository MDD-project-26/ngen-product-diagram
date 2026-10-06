import { test,expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type ReferenceRect={x:number;y:number;width:number;height:number};
const figmaGeometry=JSON.parse(readFileSync('design-reference/figma-geometry.json','utf8')) as {root:ReferenceRect&{id:string};layers:(ReferenceRect&{name:string;text?:string})[]}[];

const transform = (page:Page) => page.locator('.diagram-world').evaluate(el=>{
  const pan=getComputedStyle(el.parentElement!);
  return {x:parseFloat(pan.left),y:parseFloat(pan.top),scale:new DOMMatrix(getComputedStyle(el).transform).a};
});
const settle = async(page:Page) => {await page.waitForTimeout(420);};

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>document.fonts.ready);
});

test('all Figma assets and fonts load; the overview fits the responsive module',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'How is NGEN’s SG Connect structured?'})).toBeVisible();
  await expect(page.locator('[data-product]')).toHaveCount(8);
  await expect.poll(()=>page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  const assets=await page.evaluate(()=>[...document.images].map(i=>({src:i.getAttribute('src'),w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height})));
  expect(assets.every(i=>i.src?.startsWith('/assets/')&&i.w>0&&i.h>0)).toBe(true);
  expect(new Set(assets.map(i=>i.src)).size).toBe(25);
  expect(await page.evaluate(()=>[...document.images].filter(i=>i.src.endsWith('.svg')).every(i=>Math.abs(parseFloat(getComputedStyle(i).width)-i.naturalWidth)<0.1&&Math.abs(parseFloat(getComputedStyle(i).height)-i.naturalHeight)<0.1))).toBe(true);
  expect(await page.evaluate(()=>document.fonts.check('500 48px Inter')&&document.fonts.check('600 12px "Geist Mono"')&&document.fonts.check('400 12px "Material Symbols Rounded"'))).toBe(true);
  const geometry=await page.evaluate(()=>{
    const canvas=document.querySelector('.canvas-viewport')!.getBoundingClientRect();
    return {fits:[...document.querySelectorAll('[data-product]')].every(n=>{const r=n.getBoundingClientRect();return r.left>=canvas.left&&r.right<=canvas.right&&r.top>=canvas.top&&r.bottom<=canvas.bottom;}),overflow:document.documentElement.scrollWidth>innerWidth,canvasBottom:canvas.bottom,height:innerHeight};
  });
  expect(geometry.fits).toBe(true);expect(geometry.overflow).toBe(false);expect(geometry.canvasBottom).toBeLessThanOrEqual(geometry.height);
  expect(errors).toEqual([]);
});

test('zoom, pan, wheel zoom, fit and keyboard controls work',async({page})=>{
  const start=await transform(page);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await settle(page);
  expect((await transform(page)).scale).toBeCloseTo(start.scale*1.25,3);
  const viewport=await page.locator('.canvas-viewport').boundingBox();if(!viewport)throw new Error('Missing canvas');
  const before=await transform(page);
  await page.mouse.move(viewport.x+viewport.width-60,viewport.y+120);
  await page.mouse.down();await page.mouse.move(viewport.x+viewport.width-130,viewport.y+160,{steps:10});await page.mouse.up();
  const after=await transform(page);expect(after.x-before.x).toBeCloseTo(-70,1);expect(after.y-before.y).toBeCloseTo(40,1);
  await page.keyboard.down('Control');await page.mouse.wheel(0,-40);await page.keyboard.up('Control');await settle(page);
  expect((await transform(page)).scale).toBeGreaterThan(after.scale);
  await page.locator('.canvas-viewport').focus();await page.keyboard.press('0');await settle(page);
  expect((await transform(page)).scale).toBeCloseTo(start.scale,3);
  await page.locator('.canvas-viewport').focus();await page.keyboard.press('+');await settle(page);
  expect((await transform(page)).scale).toBeGreaterThan(start.scale);
  await page.keyboard.press('0');await settle(page);
  expect((await transform(page)).scale).toBeCloseTo(start.scale,3);
});

test('trackpad scrolling batches fractional input, preserves travel and normalizes wheel units',async({page})=>{
  const before=await transform(page);
  const batch=await page.locator('.canvas-viewport').evaluate(canvas=>{
    const pan=document.querySelector('.diagram-pan')!;
    const start=parseFloat(getComputedStyle(pan).left);
    const prevented=[];
    for(let i=0;i<120;i++)prevented.push(!canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:0.25,deltaY:0.75})));
    return {start,immediate:parseFloat(getComputedStyle(pan).left),prevented:prevented.every(Boolean)};
  });
  expect(batch.prevented).toBe(true);expect(batch.immediate).toBe(batch.start);
  await expect.poll(async()=>Math.abs((await transform(page)).x-before.x+34.5)).toBeLessThan(0.02);
  await expect.poll(async()=>Math.abs((await transform(page)).y-before.y+103.5)).toBeLessThan(0.02);
  const atRest=await transform(page);await page.waitForTimeout(150);
  expect(await transform(page)).toEqual(atRest);
  await page.locator('.canvas-viewport').evaluate(canvas=>canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:2,deltaMode:1,shiftKey:true})));
  await expect.poll(async()=>Math.abs((await transform(page)).x-atRest.x+36.8)).toBeLessThan(0.02);
  expect((await transform(page)).y).toBeCloseTo(atRest.y,2);
  const line=await transform(page),height=await page.locator('.canvas-viewport').evaluate(el=>el.clientHeight);
  await page.locator('.canvas-viewport').evaluate(canvas=>canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:0.1,deltaMode:2})));
  await expect.poll(async()=>Math.abs((await transform(page)).y-line.y+height*0.115)).toBeLessThan(0.02);
});

test('trackpad pinch stays anchored throughout smoothing, reverses and cancels on drag',async({page})=>{
  await page.locator('.zoom-value').click();await settle(page);
  const before=await transform(page);
  const v=(await page.locator('.canvas-viewport').boundingBox())!;
  // WheelEvent mouse coordinates are integers, including in synthetic streams.
  const point={x:Math.round(v.x+v.width*.35)-v.x,y:Math.round(v.y+v.height*.4)-v.y};
  const frames=await page.locator('.canvas-viewport').evaluate(async(canvas,point)=>{
    const rect=canvas.getBoundingClientRect();
    for(let i=0;i<30;i++)canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-1,clientX:rect.x+point.x,clientY:rect.y+point.y}));
    const samples=[];
    for(let i=0;i<20;i++){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const pan=getComputedStyle(document.querySelector('.diagram-pan')!),s=new DOMMatrix(getComputedStyle(document.querySelector('.diagram-world')!).transform).a;
      samples.push({x:parseFloat(pan.left),y:parseFloat(pan.top),scale:s});
    }
    return samples;
  },point);
  expect(frames.filter(f=>f.scale>1.001&&f.scale<Math.exp(.36)-.001).length).toBeGreaterThan(1);
  for(const f of frames){
    expect(f.scale).toBeGreaterThanOrEqual(1);expect(f.scale).toBeLessThanOrEqual(Math.exp(.36)+.00001);
    expect(Math.abs((point.x-f.x)/f.scale-(point.x-before.x)/before.scale)).toBeLessThan(.03);
    expect(Math.abs((point.y-f.y)/f.scale-(point.y-before.y)/before.scale)).toBeLessThan(.03);
  }
  await expect.poll(async()=>(await transform(page)).scale).toBeCloseTo(Math.exp(.36),4);
  await page.locator('.canvas-viewport').evaluate((canvas,point)=>{
    const r=canvas.getBoundingClientRect();
    for(let i=0;i<30;i++)canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,metaKey:true,deltaY:1,clientX:r.x+point.x,clientY:r.y+point.y}));
  },point);
  await expect.poll(async()=>(await transform(page)).scale).toBeCloseTo(1,4);
  await page.mouse.move(v.x+v.width-70,v.y+100);
  await page.mouse.wheel(0,200);
  await page.mouse.down();await page.mouse.move(v.x+v.width-100,v.y+130,{steps:3});await page.mouse.up();
  const released=await transform(page);await page.waitForTimeout(220);
  expect(await transform(page)).toEqual(released);
});

test('native trackpad gestures avoid double zoom and reduced motion has no smoothing tail',async({page})=>{
  const before=await transform(page),v=(await page.locator('.canvas-viewport').boundingBox())!;
  const point={x:v.width*.5,y:v.height*.5};
  const prevented=await page.locator('.canvas-viewport').evaluate((canvas,point)=>{
    const r=canvas.getBoundingClientRect();
    const send=(type:string,scale:number)=>canvas.dispatchEvent(Object.assign(new Event(type,{bubbles:true,cancelable:true}),{scale,clientX:r.x+point.x+20,clientY:r.y+point.y+30}));
    const start=canvas.dispatchEvent(Object.assign(new Event('gesturestart',{bubbles:true,cancelable:true}),{scale:1,clientX:r.x+point.x,clientY:r.y+point.y}));
    send('gesturechange',1.2);send('gesturechange',1.5);
    canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-100}));
    send('gestureend',1.5);return !start;
  },point);
  expect(prevented).toBe(true);
  await expect.poll(async()=>(await transform(page)).scale).toBeCloseTo(before.scale*1.5,4);
  const after=await transform(page);
  expect(after.x).toBeCloseTo(point.x+20-(point.x-before.x)*1.5,1);
  expect(after.y).toBeCloseTo(point.y+30-(point.y-before.y)*1.5,1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  const reduced=await transform(page);
  const samples=await page.locator('.canvas-viewport').evaluate(async canvas=>{
    canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:100}));
    const samples=[];
    for(let i=0;i<6;i++){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      samples.push(parseFloat(getComputedStyle(document.querySelector('.diagram-pan')!).left));
    }
    return samples;
  });
  for(const x of samples)expect(Math.min(Math.abs(x-reduced.x),Math.abs(x-reduced.x+115))).toBeLessThan(.02);
  expect(samples.at(-1)).toBeCloseTo(reduced.x-115,1);
});

test('text, artwork, cards and connectors keep identical proportions from 5% to 200%',async({page})=>{
  const sizes=()=>page.locator('.diagram-world').evaluate(world=>{
    const scale=new DOMMatrix(getComputedStyle(world).transform).a;
    return [...world.querySelectorAll('.product-node,.node-image,.node-copy h2,.node-copy p,.action,.app-card,.app-copy h2,.feature-row,.design-layers p,.design-layers img')].map(el=>{
      const r=el.getBoundingClientRect();return {width:r.width/scale,height:r.height/scale};
    });
  });
  await page.locator('.zoom-value').click();await settle(page);
  const original=await sizes();
  for(const target of [0.05,0.25,1.5,2]) {
    const v=(await page.locator('.canvas-viewport').boundingBox())!;
    await page.mouse.move(v.x+v.width/2,v.y+v.height/2);
    const current=(await transform(page)).scale;
    await page.keyboard.down('Control');
    await page.mouse.wheel(0,-Math.log(target/current)/0.012);
    await page.keyboard.up('Control');
    await expect.poll(async()=>(await transform(page)).scale).toBeCloseTo(target,3);
    // Zoom can move a CTA under the pointer and trigger its separate hover animation.
    await page.mouse.move(0,0);
    await expect.poll(()=>page.locator('.diagram-world .action').evaluateAll(buttons=>buttons.every(button=>Math.abs(new DOMMatrix(getComputedStyle(button).transform).a-1)<0.000001))).toBe(true);
    const actual=await sizes();
    actual.forEach((size,i)=>{
      expect(Math.abs(size.width-original[i].width)).toBeLessThan(0.05);
      expect(Math.abs(size.height-original[i].height)).toBeLessThan(0.05);
    });
  }
  await expect(page.locator('.zoom-value')).toHaveText('200%');
  await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();
  await page.locator('.canvas-viewport').press('+');await settle(page);
  expect((await transform(page)).scale).toBe(2);
});

test('card interiors match the measured Figma geometry',async({page})=>{
  const expected=figmaGeometry.flatMap(card=>{
    const root='[data-node-id="'+card.root.id+'"]';
    const app=card.root.id==='6256:25233';
    const layers=card.layers.flatMap(layer=>{
      const selector=layer.name==='Imge'?'.node-image':layer.name==='Text Container'?'.node-copy':layer.name==='Card Image'?'.app-image':layer.name==='Card Content'?'.app-copy':layer.name==='Subheading'?'h2':layer.name==='Subtitle'&&!app?'.node-copy p':layer.name==='Designed Button'?'.action':null;
      return selector?[{selector:root+' '+selector,...layer}]:[];
    });
    return [{selector:root,...card.root},...layers];
  });
  const actual=await page.evaluate(expected=>{
    const world=document.querySelector('.diagram-world')!;
    const w=world.getBoundingClientRect(),s=new DOMMatrix(getComputedStyle(world).transform).a;
    return expected.map(({selector})=>{
      const r=document.querySelector(selector)!.getBoundingClientRect();
      return {x:(r.x-w.x)/s,y:(r.y-w.y)/s,width:r.width/s,height:r.height/s};
    });
  },expected);
  actual.forEach((rect,i)=>{
    for(const key of ['x','y','width','height'] as const)
      expect(Math.abs(rect[key]-expected[i][key]),expected[i].selector+' '+key).toBeLessThan(0.1);
  });
});

test('tooltips always sit to the right; Explore has no pop-ups and extra controls are removed',async({page})=>{
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Canvas controls and keyboard shortcuts'})).toHaveCount(0);
  await expect(page.locator('#canvas-instructions')).toBeVisible();
  const aboutButtons=page.locator('.info-button');
  for(let i=0;i<await aboutButtons.count();i++) {
    const about=aboutButtons.nth(i);
    await about.focus();await settle(page);
    await expect(page.getByRole('tooltip')).toBeVisible();
    // Sample both rectangles in one frame, and wait for the animated camera to settle.
    await expect.poll(()=>about.evaluate(button=>{
      const tooltip=document.querySelector('[role="tooltip"]')!.getBoundingClientRect();
      const card=button.parentElement!.getBoundingClientRect();
      const scale=new DOMMatrix(getComputedStyle(document.querySelector('.diagram-world')!).transform).a;
      return Math.abs(tooltip.x-card.right-12*scale)<0.05&&Math.abs(tooltip.y-card.y)<0.05;
    })).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  }
  const about=page.getByRole('button',{name:'About Aggregator',exact:true});
  await about.focus();await settle(page);
  await about.click();await expect(about).toHaveAttribute('aria-expanded','true');
  const viewport=(await page.locator('.canvas-viewport').boundingBox())!;
  await page.mouse.move(viewport.x+30,viewport.y+150);
  await page.mouse.down();await page.mouse.move(viewport.x+10,viewport.y+180,{steps:5});await page.mouse.up();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(about).toHaveAttribute('aria-expanded','true');
  await about.click();await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.locator('[data-product="aggregator"]').getByRole('button',{name:'Explore',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.locator('[data-product="vpp"] .action').count()).toBe(0);
  const appButton=page.getByRole('button',{name:'Explore SG Connect App',exact:true});
  await appButton.focus();await settle(page);await appButton.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('full screen expands the canvas and restores it on exit',async({page})=>{
  const before=(await page.locator('.canvas-viewport').boundingBox())!;
  await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Exit full screen',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.canvas-viewport').evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(page.viewportSize()!.height);
  await expect(page.locator('#canvas-instructions')).toBeVisible();
  await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enter full screen',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.canvas-viewport').evaluate(el=>Math.round(el.getBoundingClientRect().height))).toBe(Math.round(before.height));
  await expect(page.locator('.canvas-viewport')).not.toHaveClass(/is-expanded/);
  const restored=(await page.locator('.canvas-viewport').boundingBox())!;
  for(const key of ['x','y','width','height'] as const)expect(restored[key]).toBeCloseTo(before[key],1);
  // Embedded previews without fullscreen permission use the same visible controls.
  await page.evaluate(()=>{document.querySelector('.module')!.requestFullscreen=()=>Promise.reject(new Error('Not allowed in embed'));});
  await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
  await expect(page.locator('.canvas-viewport')).toHaveClass(/is-expanded/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-viewport')).not.toHaveClass(/is-expanded/);
});

test('hovering a tooltip preserves the node text pixels at 200% zoom',async({page})=>{
  await page.setViewportSize({width:2400,height:1400});
  const about=page.getByRole('button',{name:'About SG Brain',exact:true});
  await about.focus();await settle(page);await page.keyboard.press('Escape');
  await page.locator('.zoom-value').click();await settle(page);
  const viewport=page.locator('.canvas-viewport');
  await viewport.focus();
  for(let i=0;i<4;i++){await page.keyboard.press('+');await settle(page);}
  await expect(page.locator('.zoom-value')).toHaveText('200%');
  const v=(await viewport.boundingBox())!;
  await page.mouse.move(v.x+v.width-100,v.y+v.height-100);
  await page.mouse.down();await page.mouse.move(v.x+v.width-300,v.y+v.height-100,{steps:5});await page.mouse.up();
  await page.mouse.move(0,0);
  const title=page.locator('[data-product="brain"] h2');
  const description=page.locator('[data-product="brain"] .node-copy p');
  const titleBefore=await title.screenshot(),descriptionBefore=await description.screenshot();
  await about.hover();
  const tooltip=page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect.poll(()=>tooltip.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  expect((await title.screenshot()).equals(titleBefore)).toBe(true);
  expect((await description.screenshot()).equals(descriptionBefore)).toBe(true);
  await tooltip.hover();
  expect((await title.screenshot()).equals(titleBefore)).toBe(true);
  expect((await description.screenshot()).equals(descriptionBefore)).toBe(true);
  expect(await tooltip.evaluate(el=>({filter:getComputedStyle(el).filter,backdrop:getComputedStyle(el).backdropFilter,transform:getComputedStyle(el).transform}))).toEqual({filter:'none',backdrop:'none',transform:'none'});
});

test('fullscreen animates bounds softly, keeps node proportions and reverses cleanly',async({page})=>{
  await page.evaluate(()=>{document.querySelector('.module')!.requestFullscreen=()=>Promise.reject(new Error('Embedded preview'));});
  const before=(await page.locator('.canvas-viewport').boundingBox())!;
  const initialScale=(await transform(page)).scale;
  const sample=async(opening:boolean)=>page.evaluate(async opening=>{
    const canvas=document.querySelector('.canvas-viewport')!;
    const world=document.querySelector('.diagram-world')!;
    const frames:{x:number;y:number;width:number;height:number;nodeWidth:number;scale:number}[]=[];
    (document.querySelector('.fullscreen-button') as HTMLButtonElement).click();
    for(let i=0;i<180;i++){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const r=canvas.getBoundingClientRect();
      frames.push({x:r.x,y:r.y,width:r.width,height:r.height,nodeWidth:world.querySelector('.product-node')!.getBoundingClientRect().width,scale:new DOMMatrix(getComputedStyle(world).transform).a});
      if(i>2&&(opening?Math.abs(r.width-innerWidth)<0.01&&Math.abs(r.height-innerHeight)<0.01:!canvas.classList.contains('is-expanded')))break;
    }
    return frames;
  },opening);
  const opened=await sample(true),closed=await sample(false);
  for(const frames of [opened,closed]){
    expect(frames.filter(f=>f.y>1&&f.y<before.y-1).length).toBeGreaterThan(5);
    frames.forEach(f=>{
      expect(f.width).toBeGreaterThanOrEqual(before.width-0.1);
      expect(f.width).toBeLessThanOrEqual(page.viewportSize()!.width+0.1);
      expect(f.height).toBeGreaterThanOrEqual(before.height-0.1);
      expect(f.height).toBeLessThanOrEqual(page.viewportSize()!.height+0.1);
      expect(f.scale).toBeCloseTo(initialScale,5);
      expect(f.nodeWidth/f.scale).toBeCloseTo(600,2);
    });
  }
  const restored=(await page.locator('.canvas-viewport').boundingBox())!;
  for(const key of ['x','y','width','height'] as const)expect(restored[key]).toBeCloseTo(before[key],1);
  // Reverse before the spring settles; the same canvas returns to its anchor.
  await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-viewport')).not.toHaveClass(/is-expanded/);
  expect(await page.locator('.canvas-viewport').boundingBox()).toEqual(before);
});

test('fullscreen respects reduced motion, resizing and Escape during a pending API request',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await page.evaluate(()=>{document.querySelector('.module')!.requestFullscreen=()=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('Embedded preview')),150));});
  await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-viewport')).not.toHaveClass(/is-expanded/);
  await expect(page.getByRole('button',{name:'Enter full screen',exact:true})).toBeEnabled();
  await page.evaluate(()=>{document.querySelector('.module')!.requestFullscreen=()=>Promise.reject(new Error('Embedded preview'));});
  await page.getByRole('button',{name:'Enter full screen',exact:true}).click();
  await expect.poll(()=>page.locator('.canvas-viewport').boundingBox()).toEqual({x:0,y:0,...page.viewportSize()!});
  await page.setViewportSize({width:640,height:720});
  await expect.poll(()=>page.locator('.canvas-viewport').boundingBox()).toEqual({x:0,y:0,width:640,height:720});
  await page.keyboard.press('Escape');
  await expect(page.locator('.canvas-viewport')).not.toHaveClass(/is-expanded/);
  const frame=(await page.locator('.canvas-frame').boundingBox())!;
  expect(await page.locator('.canvas-viewport').boundingBox()).toEqual(frame);
  expect(await page.locator('.canvas-viewport').evaluate(el=>getComputedStyle(el).borderRadius)).toBe('28px');
});

test('touch drag and pinch move and scale the canvas',async({page,browserName})=>{
  test.skip(browserName!=='chromium');
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const v=(await page.locator('.canvas-viewport').boundingBox())!;
  const x=v.x+v.width*.7,y=v.y+v.height*.3;
  const before=await transform(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30,y:y+30,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Math.round((await transform(page)).x-before.x)).toBe(-30);
  const pan=await transform(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>(await transform(page)).scale).toBeCloseTo(pan.scale*2,2);
});

test('narrow and short viewports fit; reduced motion keeps controls usable',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.reload();
  await expect(page.locator('.canvas-viewport')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.canvas-viewport').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'About SG Brain',exact:true}).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
