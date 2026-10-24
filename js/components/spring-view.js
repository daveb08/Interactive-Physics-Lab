import { CART_WIDTH } from '../core/spring-physics.js';
const blue='#3c6cb2',orange='#b65b25';
/** Half-widths of the visible track (m), and the label spacing for each. */
export const ZOOM_STEPS=[6,12,25,50];
const TICK_STEP={6:2,12:4,25:5,50:10};
/** Drawn cart width in pixels: 1 m at the closest zoom (660 px / 12 m ≈ 55 px), the same at every zoom. */
const CART_PX=CART_WIDTH*660/12;
const arrow=(x,y,length,color,id)=>Math.abs(length)<1e-9?'':`<path d="M${x} ${y}h${length}" stroke="${color}" stroke-width="3" fill="none" marker-end="url(#${id})"/>`;
const marker=(id,color)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;
export class SpringView {
 constructor(scene,a,b){Object.assign(this,{scene,a,b});}
 render(run,reveal,fbdReveal={A:false,B:false}){
  // The view zooms out in a few fixed steps as the carts separate, and the carts keep one drawn size.
  // (A continuously rescaling axis made the carts appear to shrink, and to slow down while moving at constant speed.)
  const s=run.state,needed=Math.max(Math.abs(s.xA),Math.abs(s.xB))+2;
  const extent=ZOOM_STEPS.find(e=>e>=needed)??ZOOM_STEPS.at(-1);
  const scale=660/(2*extent),x=p=>390+p*scale,width=CART_PX;
  const step=TICK_STEP[extent],ticks=[];
  for(let p=-extent;p<=extent+1e-9;p+=step)ticks.push(+p.toFixed(6));
  const initialForce=run.stiffness*run.compression;
  const length=reveal?75*Math.abs(s.fA)/initialForce:0;
  const cart=(pos,label,mass,color,dir)=>`<g><rect x="${x(pos)-width/2}" y="153" width="${width}" height="32" rx="4" fill="${color}"/><circle cx="${x(pos)-width*.3}" cy="190" r="5" fill="#243d3b"/><circle cx="${x(pos)+width*.3}" cy="190" r="5" fill="#243d3b"/><text x="${x(pos)}" y="145" text-anchor="middle" fill="${color}" font-size="14">${label} · ${mass} kg</text>${arrow(x(pos),112,dir*length,color,dir<0?'scene-a':'scene-b')}</g>`;
  const left=x(s.xA)+width/2,right=x(s.xB)-width/2;
  const spring=Array.from({length:17},(_,i)=>`${i?'L':'M'}${left+(right-left)*i/16} ${i===0||i===16?170:i%2?160:180}`).join(' ');
  this.scene.innerHTML=`<defs>${marker('scene-a',blue)}${marker('scene-b',orange)}</defs><text x="390" y="30" text-anchor="middle" fill="#5f6e6d" font-size="13">${s.interacting?'Compressed spring · contact':'Spring fully released · no contact'}</text><path d="M60 198H720" stroke="#74877b" stroke-width="3"/>${s.interacting?`<path d="${spring}" stroke="#5f6e6d" stroke-width="2" fill="none"/>`:''}${cart(s.xA,'A',run.massA,blue,-1)}${cart(s.xB,'B',run.massB,orange,1)}${ticks.map(p=>`<path d="M${x(p)} 201v7" stroke="#a7b3aa"/><text x="${x(p)}" y="226" text-anchor="middle" font-size="14" fill="#5f6e6d">${p}</text>`).join('')}<text x="390" y="255" text-anchor="middle" font-size="13" fill="#5f6e6d">Position x (m) · positive to the right → · view ±${extent} m (steps out as the carts separate)</text>`;
  this.scene.setAttribute('aria-label',`Cart A at ${s.xA.toFixed(3)} m, Cart B at ${s.xB.toFixed(3)} m. ${s.interacting?'Spring compressed':'Separated, no interaction force'}.`);
  for(const [svg,name,mass,force,color,dir] of [[this.a,'A',run.massA,s.fA,blue,-1],[this.b,'B',run.massB,s.fB,orange,1]]){
   if(!fbdReveal[name]) {svg.innerHTML=`<text x="200" y="90" text-anchor="middle" font-size="16">Cart ${name}</text><text x="200" y="128" text-anchor="middle" font-size="14">Choose “Build Cart ${name}’s diagram” above,</text><text x="200" y="150" text-anchor="middle" font-size="14">pick its forces below, then press Check diagram.</text>`;svg.setAttribute('aria-label',`Cart ${name} free-body diagram hidden. Check your selection to view.`);continue;}
   const fbdLength=75*Math.abs(force)/initialForce;
   const id=`fbd-${name}-tip`,vertical=30+mass*2;
   svg.innerHTML=`<defs>${marker(id,color)}${marker(id+'-v','#5f6e6d')}</defs><text x="200" y="20" text-anchor="middle" font-size="16" fill="${color}">Cart ${name} · ${mass} kg</text><rect x="177" y="95" width="46" height="38" rx="6" fill="${color}"/><text x="200" y="120" text-anchor="middle" fill="white">${name}</text>${arrow(200+dir*23,114,dir*fbdLength,color,id)}<path d="M200 95v-${vertical}" stroke="#5f6e6d" stroke-width="2" marker-end="url(#${id}-v)"/><path d="M200 133v${vertical}" stroke="#5f6e6d" stroke-width="2" marker-end="url(#${id}-v)"/><text x="220" y="${95-vertical}" font-size="12">N = ${(mass*9.81).toFixed(2)} N</text><text x="220" y="${140+vertical}" font-size="12">mg = ${(mass*9.81).toFixed(2)} N</text><text x="200" y="211" text-anchor="middle" font-size="12" fill="${color}">${name==='A'?'B on A':'A on B'} (via ideal spring): ${force.toFixed(3)+' N'}</text>`;
   svg.setAttribute('aria-label',`Free-body diagram for Cart ${name}. Normal force upward and weight downward balance at ${(mass*9.81).toFixed(2)} N. ${force===0?'No horizontal interaction force after separation.':`Horizontal interaction force ${Math.abs(force).toFixed(3)} N ${dir<0?'left':'right'}.`}`);
  }
  return extent;
 }
}
