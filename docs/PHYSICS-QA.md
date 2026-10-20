# Independent physics references

`qa/reference.js` imports no production code. `qa/physics.test.js` imports simulator functions only as subjects under test. Expected values are closed-form equations or an independently written RK4 integration of the governing ODE.

All quantities use SI: kg, m, s, N, J; g = 9.81 m/s². Horizontal positive is right. Oscillator displacement is positive away from the wall. Circular coordinates use mathematical +y up and counterclockwise positive; SVG rendering reverses y.

| Model | Governing equations and assumptions | Reference cases |
| --- | --- | --- |
| Constant force / Solve it | a=Fnet/m; v=v0+at; x=v0t+at²/2; level surface, ±50 m observation boundary, no collision | m=1,2,10; F=−20,0,20; v0=−5,0,5; every sampled graph point and boundary endpoint; S1–S4 answer metadata |
| Pulse | Constant acceleration until removal; then constant velocity; x,v continuous | ±4 and 0 N; 2 kg; v0=−2; removal at 2 s, immediately before/at/after |
| Coulomb friction | N=mg; static balances F up to μsN; sliding f=−sign(v)μkmg; stopping t=|v0|/(μkg), distance v0²/(2μkg) | ±6 m/s; μk=.2; threshold ±μsN plus/minus 1e−5 N |
| Third Law | Reduced mass μ=mA mB/(mA+mB); δ=δ0 cos(sqrt(k/μ)t); release πsqrt(μ/k)/2; then coast; massless compression-only spring | masses 1–10 kg, k=20 N/m, δ0=2 m; equal/opposite forces; momentum zero; initial energy kδ0²/2 |
| Drag | m v'=F−bv or F−cv², x'=v; restricted nonnegative F,v | F=0,6,20 N; v0=0,3,10; linear exponential; quadratic independent ODE integration including above/below terminal speed |
| Oscillator | m x''+b x'+kx=0; E=mv²/2+kx²/2; dE/dt=−bv² | m=1,k=16,x0=−.5; v0=−3,0,3; b=0,4,8±1e−6,8,16; all damping regimes and energy monotonicity |
| Circular | ω=v/r; r=(r cosωt,r sinωt); v tangent; a=−ω²r; tension=mv²/r; zero force and tangent line after cut | m=.5,r=1.5,v=3; cut at π s; table exit radius 3.2 m; graph endpoint |

Tolerance rule: |actual−expected| ≤ tolerance × max(1,|expected|). Closed forms use 1e−8, ODE comparisons 1e−7 (RK4 step ≤.0005 s), instructional rounded answer metadata .001. UI readouts are compared to the reference range over displayed time ±.005 s, then allow .0051 for the readout's own two-decimal rounding. This avoids confusing rounded-time error with incorrect acceleration. These are separate from prediction acceptance tolerances. Test failures are reported, not fixed during the audit.
