// Independent SI reference. No production imports or constants.
// Vacuum point charges; +x right, +y up. K matches the documented rounded model.
export const COULOMB_K = 8.988e9;
export function referenceField(sources, x, y) {
 let ex=0,ey=0,potential=0;
 for(const source of sources){
  const dx=x-source.x,dy=y-source.y,r=Math.hypot(dx,dy);
  if(r===0)throw new RangeError('Reference excludes a point-charge singularity');
  const angle=Math.atan2(dy,dx),strength=COULOMB_K*source.q/r**2;
  ex+=strength*Math.cos(angle);ey+=strength*Math.sin(angle);
  potential+=COULOMB_K*source.q/r;
 }
 return {ex,ey,potential};
}
export function referenceForce(charges,index=0){
 const target=charges[index],field=referenceField(charges.filter((_,i)=>i!==index),target.x,target.y);
 const fx=target.q*field.ex,fy=target.q*field.ey;
 return {fx,fy,magnitude:Math.hypot(fx,fy)};
}
// Simpson quadrature of k lambda q / r², distinct from production midpoint slices
// and its algebraic antiderivative.
export function referenceRod({Q,L,q,d},n=10000){
 const h=L/n,integrand=x=>COULOMB_K*(Q/L)*q/(L+d-x)**2;
 let sum=integrand(0)+integrand(L);
 for(let i=1;i<n;i++)sum+=(i%2?4:2)*integrand(i*h);
 return sum*h/3;
}
