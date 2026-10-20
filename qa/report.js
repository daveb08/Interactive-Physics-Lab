import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const run=JSON.parse(readFileSync('qa-results/run.json','utf8'));
const records=result=>{
 const out=[];const walk=s=>{for(const spec of s.specs||[])for(const t of spec.tests||[])out.push({spec,t});for(const c of s.suites||[])walk(c);};
 for(const s of result.suites||[])walk(s);return out;
};
const key=(spec,t)=>`${spec.file}|${spec.title}|${t.projectName}`;
const latest=new Map();
for(const stage of run.stages){const file=`qa-results/${stage.name}/results.json`;if(existsSync(file))for(const {spec,t} of records(JSON.parse(readFileSync(file,'utf8'))))latest.set(key(spec,t),stage.name);}
const lines=[`# Interactive Physics Lab QA report`, ``, `Run: ${run.date}. Commit: ${run.git}. Scope: ${run.mode}.`,
 '', 'Severity: Critical — incorrect physics/unusable core; High — broken activity/misleading instruction; Medium — accessibility, confusing UI or units; Low — cosmetic.',
 '', 'Inventory: First Law I1–I3; Second Law A–D/F1–F3; Third Law T1–T3/FBD; variable forces V1–V4 (linear/quadratic drag, oscillator); circle U1–U4; E1 C1–C3, point charges, rod and friction/contact/induction; Solve it S1–S4; builder/editor; all 12 routes.',
 '', '| Stage | Passed | Failed | Skipped | Exit |','| --- | ---: | ---: | ---: | ---: |'];
const details=[],evidence=['# QA evidence index',''],candidates=['# Content and layout candidates','', 'These heuristic matches are not confirmed defects. Inspect screenshots and transcripts in the [evidence index](evidence.md). The reviewed findings document distinguishes known false positives, including intentional author placeholders and controls inside closed disclosures.',''];
const accessibility=new Map();let totalPass=0,totalFail=0;
const relative=p=>p.replaceAll('\\','/').split('/qa-results/').at(-1);
function attachmentData(a){try{return JSON.parse(a.path?readFileSync(a.path,'utf8'):Buffer.from(a.body,'base64').toString());}catch{return null;}}
for(const stage of run.stages){
 if(stage.name==='fast'){
  const log=readFileSync('qa-results/fast/run.log','utf8');
  const count=key=>Number(log.match(new RegExp(`# ${key} (\\d+)`))?.[1]||0);
  const pass=count('pass'),fail=count('fail');totalPass+=pass;totalFail+=fail;
  lines.push(`| Fast physics/logic | ${pass} | ${fail} | ${count('skipped')} | ${stage.exit} |`);
  for(const m of log.matchAll(/not ok \d+ - ([^\r\n]+)/g))details.push(`- **Physics/logic failure — requires triage:** ${m[1]}. Reproduce: \`npm run qa:fast\`. [Full evidence](fast/run.log).`);
 }else{
  const file=`qa-results/${stage.name}/results.json`;
  if(!existsSync(file)){lines.push(`| ${stage.name} | 0 | unavailable | 0 | ${stage.exit} |`);details.push(`- **Infrastructure failure:** ${stage.name} did not write results. See [log](${stage.name}/run.log).`);continue;}
  const result=JSON.parse(readFileSync(file,'utf8'));
  const selected=records(result).filter(({spec,t})=>latest.get(key(spec,t))===stage.name);
  const passed=selected.filter(({t})=>t.status==='expected').length,failed=selected.filter(({t})=>!['expected','skipped'].includes(t.status)).length,skipped=selected.filter(({t})=>t.status==='skipped').length;
  totalPass+=passed;totalFail+=failed;
  lines.push(`| ${stage.name} | ${passed} | ${failed} | ${skipped} | ${stage.exit} |`);
  function walk(s){
   for(const spec of s.specs||[])for(const t of spec.tests||[]){
    if(latest.get(key(spec,t))!==stage.name)continue;
    evidence.push(`## ${spec.title} — ${t.projectName}: ${t.status}`,'');
    for(const a of t.results?.at(-1)?.attachments||[]){
     if(a.path)evidence.push(`- [${a.name}](${relative(a.path)})`);
     if(a.name==='axe.json'){
      const data=attachmentData(a);
      for(const v of data?.violations||[]){const key=`${spec.title} / ${v.id}`;const item=accessibility.get(key)||{impact:v.impact,projects:[],targets:new Set()};item.projects.push(t.projectName);for(const n of v.nodes)item.targets.add(n.target.join(' '));accessibility.set(key,item);}
     }
     if(a.name.endsWith('review-candidates.json')){
      const d=attachmentData(a),g=d?.geometry;
      if(d?.content?.length||d?.incompleteTextOrEquation?.length||g?.overflow||g?.clipped?.length||g?.overlaps?.length||g?.textCandidates?.length)candidates.push(`## ${spec.title} — ${t.projectName} — ${a.name}`,'','```json',JSON.stringify(d,null,2),'```','');
     }
    }
    evidence.push('');
    if(t.status==='expected')continue;
    const r=t.results?.at(-1),access=spec.title.startsWith('accessibility'),visual=stage.name==='visual';
    const classification=access?'Medium — automated accessibility finding':visual?'Visual regression/baseline failure — review required':spec.title.startsWith('critical damping')?'Critical — core scenario exception':spec.title.startsWith('content: quadratic')?'High — misleading equation':spec.title.startsWith('content:')?'Medium — undefined symbols':'Functional assertion failure — triage required';
    details.push(`- **${classification}:** ${spec.title} (${t.projectName}). Reproduce: \`npm run qa:${['content','recheck'].includes(stage.name)?'browser':stage.name}\`. Source: ${spec.file}:${spec.line}.`);
    if(r?.error?.message)details.push(`  \n  ${r.error.message.replace(/\u001b\[[0-9;]*m/g,'').slice(0,1400).replace(/\n/g,'  \n  ')}`);
    for(const a of r?.attachments||[])if(a.path)details.push(`  \n  [${a.name}](${relative(a.path)})`);
   }
   for(const child of s.suites||[])walk(child);
  }
  for(const s of result.suites||[])walk(s);
 }
}
lines.push('',`Total: **${totalPass} passed, ${totalFail} failed**. These counts cover only stages executed in this run. A nonzero infrastructure exit can occur without a counted test failure.`,
 '',run.notes||'Each test/project is counted once; when targeted rechecks are included, their latest result supersedes the earlier result. Original logs and artifacts remain available.',
 '',run.mode==='baseline'?'**Baseline generation:** these are provisional reference images, not approved visual quality.':'Visual comparisons use explicit baselines; missing baselines fail.',
 '', '## Reviewed findings', '',existsSync('docs/QA-FINDINGS.md')?readFileSync('docs/QA-FINDINGS.md','utf8'):'Manual triage has not yet been recorded.',
 '', '## Accessibility summary', '',...([...accessibility].map(([key,v])=>`- **Medium:** ${key}; axe impact ${v.impact}; projects ${v.projects.join(', ')}; ${v.targets.size} affected selectors. Detailed targets in the HTML report.`)),
 '', '## Failures and evidence', '',...(details.length?details:['No automated failures in the executed stages.']),
 '', '## Content, equations and limitations','',
 'Rendered text and screenshots are attached to functional tests, including incorrect guided responses, completed trials and reflections. Geometry attachments list possible overlaps/clipping. Heuristic flags need human review. Incorrect distractors are intentional teaching content, not automatically defects.',
 '', 'Independent equations, tolerances and cases: [PHYSICS-QA.md](../docs/PHYSICS-QA.md). Coverage and commands: [QA.md](../docs/QA.md).',
 '', 'Untested/limited: physical iPad and Safari/Firefox; screen-reader use; exhaustive authored inputs; full linguistic/semantic review; every force-vector pixel and graph sample in the browser; clipboard permissions across platforms; all drag-and-drop paths. Touch emulation is Chromium. Axe does not establish usability. Screenshot baselines require human approval. Existing tests that call the simulator as an oracle remain separate from independent reference checks.',
 '', 'All captured states: [evidence index](evidence.md). Heuristic content/layout review: [candidates](content-review.md). Detailed browser report: [HTML](browser/html/index.html). Visual report: [HTML](visual/html/index.html). Logs and attachments are retained locally; no application defects are automatically fixed.');
writeFileSync('qa-results/report.md',lines.join('\n'));
writeFileSync('qa-results/evidence.md',evidence.join('\n'));
writeFileSync('qa-results/content-review.md',candidates.join('\n'));
console.log('QA report: qa-results/report.md');
