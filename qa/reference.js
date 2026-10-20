// Independent reference equations. This file deliberately imports no application code.
export const G = 9.81;
export function constant(m, F, v0, t) { const a=F/m; return {x:v0*t+a*t*t/2,v:v0+a*t,a}; }
export function pulse(m,F,v0,removal,t) {
  const u=Math.min(t,removal), first=constant(m,F,v0,u);
  return {x:first.x+first.v*(t-u),v:first.v,a:t<removal?F/m:0};
}
export function stopping(v0,mu,t) {
  const end=Math.abs(v0)/(mu*G), u=Math.min(t,end), a=-Math.sign(v0)*mu*G;
  return {x:v0*u+a*u*u/2,v:t>=end?0:v0+a*u,a:t>=end?0:a,end};
}
export function linear(m,F,b,v0,t) {
  const terminal=F/b, e=Math.exp(-b*t/m), v=terminal+(v0-terminal)*e;
  return {x:terminal*t+(v0-terminal)*m/b*(1-e),v,a:(F-b*v)/m};
}
// Independent small-step RK4 ODE oracle: distinct from production integrators and closed forms.
export function ode(accel,x,v,t,h=0.0005) {
  const n=Math.ceil(t/h); if(!n)return {x,v,a:accel(x,v)}; h=t/n;
  for(let i=0;i<n;i++) {
    const a1=accel(x,v), v2=v+h*a1/2, a2=accel(x+h*v/2,v2);
    const v3=v+h*a2/2, a3=accel(x+h*v2/2,v3), v4=v+h*a3, a4=accel(x+h*v3,v4);
    x+=h*(v+2*v2+2*v3+v4)/6; v+=h*(a1+2*a2+2*a3+a4)/6;
  }
  return {x,v,a:accel(x,v)};
}
