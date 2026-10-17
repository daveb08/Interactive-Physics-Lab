import { CART_WIDTH } from '../core/spring-physics.js';
const blue='#3c6cb2',orange='#b65b25';
const arrow=(x,y,length,color,id)=>Math.abs(length)<1e-9?'':`<path d="M${x} ${y}h${length}" stroke="${color}" stroke-width="3" fill="none" marker-end="url(#${id})"/>`;
const marker=(id,color)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;
export class SpringView {
 constructor(scene,a,b){Object.assign(this,{scene,a,b});}
 render(run,reveal){
  const s=run.state,extent=Math.min(50,Math.max(6,Math.abs(s.xA)+2,Math.abs(s.xB)+2));
  const scale=660/(2*extent),x=p=>390+p*scale,width=CART_WIDTH*scale;
  const initialForce=run.stiffness*run.compression;
  const length=reveal?75*Math.abs(s.fA)/initialForce:0;
  const cart=(pos,label,mass,color,dir)=>`<g><rect x="${x(pos)-width/2}" y="153" width="${width}" height="32" rx="4" fill="${color}"/><circle cx="${x(pos)-width*.3}" cy="190" r="5" fill="#243d3b"/><circle cx="${x(pos)+width*.3}" cy="190" r="5" fill="#243d3b"/><text x="${x(pos)}" y="145" text-anchor="middle" fill="${color}" font-size="14">${label} · ${mass} kg</text>${arrow(x(pos),112,dir*length,color,dir<0?'scene-a':'scene-b')}</g>`;
  const left=x(s.xA)+width/2,right=x(s.xB)-width/2;
  const spring=Array.from({length:17},(_,i)=>`${i?'L':'M'}${left+(right-left)*i/16} ${i===0||i===16?170:i%2?160:180}`).join(' ');
  this.scene.innerHTML=`<defs>${marker('scene-a',blue)}${marker('scene-b',orange)}</defs><text x="390" y="30" text-anchor="middle" fill="#667674" font-size="13">${s.interacting?'Compressed spring · contact':'Spring fully released · no contact'}</text><path d="M60 198H720" stroke="#74877b" stroke-width="3"/>${s.interacting?`<path d="${spring}" stroke="#667674" stroke-width="2" fill="none"/>`:''}${cart(s.xA,'A',run.massA,blue,-1)}${cart(s.xB,'B',run.massB,orange,1)}${[-extent,0,extent].map(p=>`<text x="${x(p)}" y="225" text-anchor="middle" font-size="12" fill="#667674">${p.toFixed(1)} m</text>`).join('')}<text x="390" y="255" text-anchor="middle" font-size="12" fill="#667674">Positive x → · view expands as carts separate</text>`;
  this.scene.setAttribute('aria-label',`Cart A at ${s.xA.toFixed(3)} m, Cart B at ${s.xB.toFixed(3)} m. ${s.interacting?'Spring compressed':'Separated, no interaction force'}.`);
  for(const [svg,name,mass,force,color,dir] of [[this.a,'A',run.massA,s.fA,blue,-1],[this.b,'B',run.massB,s.fB,orange,1]]){
   const id=`fbd-${name}-tip`,vertical=30+mass*2;
   svg.innerHTML=`<defs>${marker(id,color)}${marker(id+'-v','#667674')}</defs><text x="200" y="20" text-anchor="middle" font-size="16" fill="${color}">Cart ${name} · ${mass} kg</text><rect x="177" y="95" width="46" height="38" rx="6" fill="${color}"/><text x="200" y="120" text-anchor="middle" fill="white">${name}</text>${arrow(200+dir*23,114,dir*length,color,id)}<path d="M200 95v-${vertical}" stroke="#667674" stroke-width="2" marker-end="url(#${id}-v)"/><path d="M200 133v${vertical}" stroke="#667674" stroke-width="2" marker-end="url(#${id}-v)"/><text x="220" y="${95-vertical}" font-size="12">N = ${(mass*9.81).toFixed(2)} N</text><text x="220" y="${140+vertical}" font-size="12">mg = ${(mass*9.81).toFixed(2)} N</text><text x="200" y="211" text-anchor="middle" font-size="12" fill="${color}">${name==='A'?'B on A':'A on B'} (via ideal spring): ${reveal?force.toFixed(3)+' N':'observe after starting'}</text>`;
   svg.setAttribute('aria-label',`Free-body diagram for Cart ${name}. Normal force and weight balance at ${(mass*9.81).toFixed(2)} N. ${reveal?`Horizontal interaction force ${force.toFixed(3)} N.`:'Horizontal force revealed after starting.'}`);
  }
  return extent;
 }
}
