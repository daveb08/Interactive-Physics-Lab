import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readdirSync,unlinkSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2]||'all';
const browserArgs=process.argv.slice(3);
if(!['all','fast','browser','visual','baseline'].includes(mode))throw new Error(`Unknown QA mode: ${mode}`);
const root=path.resolve('qa-results');mkdirSync(root,{recursive:true});
const stages=[];
function run(name,args,env={}){
 const prior=path.join(root,name,'results.json');if(existsSync(prior))unlinkSync(prior);
 const start=new Date().toISOString();
 console.log(`QA: ${name}`);
 const out=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,...env},maxBuffer:50*1024*1024});
 mkdirSync(path.join(root,name),{recursive:true});
 writeFileSync(path.join(root,name,'run.log'),(out.stdout||'')+(out.stderr||'')+(out.error?.stack||''));
 console.log((out.stdout||'').slice(-1800));if(out.stderr)console.error(out.stderr.slice(-1800));
 stages.push({name,start,exit:out.status??1});
}
if(['all','fast'].includes(mode)){
 const files=[...readdirSync('tests').filter(f=>f.endsWith('.test.js')).map(f=>`tests/${f}`),'qa/physics.test.js'];
 run('fast',['--test','--test-reporter=tap',...files]);
}
if(['all','browser'].includes(mode))run('browser',['node_modules/@playwright/test/cli.js','test',...browserArgs],{QA_SUITE:'browser'});
if(['all','visual','baseline'].includes(mode))run('visual',['node_modules/@playwright/test/cli.js','test',...browserArgs,...(mode==='baseline'?['--update-snapshots']:[])],{QA_SUITE:'visual'});
const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
writeFileSync(path.join(root,'run.json'),JSON.stringify({mode,git,stages,date:new Date().toISOString()},null,2));
await import('../qa/report.js');
process.exitCode=stages.some(s=>s.exit!==0)?1:0;
