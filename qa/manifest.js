export const routes = [
  '/index.html', '/modules/newtons-laws/index.html', '/modules/newtons-laws/first-law.html',
  '/modules/newtons-laws/third-law.html', '/modules/newtons-laws/solve.html',
  '/modules/newtons-laws/build.html', '/modules/newtons-laws/author.html',
  '/modules/variable-forces/index.html', '/modules/circular-motion/index.html',
  '/modules/circular-motion/uniform.html', '/modules/electromagnetism/index.html',
  '/modules/electromagnetism/coulomb.html', '/modules/electromagnetism/solve.html', '/modules/electromagnetism/build.html',
];
export const labs = [
  { id:'first', path:routes[2], activities:['I1','I2','I3'], answers:['B','B','B'], time:'#time' },
  { id:'second', path:routes[1], activities:['A','B','C','D','F1','F2','F3'], time:'#time' },
  { id:'third', path:routes[3], activities:['T1','T2','T3'], time:'#time', select:'#activity-select', form:'#prediction-form' },
  { id:'drag', path:routes[7], activities:['V1','V2','V3','V4'], time:'#r-t' },
  { id:'circle', path:routes[9], activities:['U1','U2','U3','U4'], time:'#r-t' },
];
export const freeScenarios = [...labs, {id:'quadratic',path:routes[7],time:'#r-t'}, {id:'oscillator',path:routes[7],time:'#r-t'}];
