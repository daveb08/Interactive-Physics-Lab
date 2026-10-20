import AxeBuilder from '@axe-core/playwright';
import {test,expect,open,evidence} from './helpers.js';
import {routes} from '../manifest.js';
for(const path of routes)test(`accessibility ${path}`,async({page},info)=>{
 await open(page,path);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 await info.attach('axe.json',{body:JSON.stringify({violations:result.violations,incomplete:result.incomplete},null,2),contentType:'application/json'});
 await evidence(page,info,'accessibility');
 expect(result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
});
