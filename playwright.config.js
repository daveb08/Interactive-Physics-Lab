import {defineConfig} from '@playwright/test';
const suite=process.env.QA_SUITE||'browser';
const output=process.env.QA_OUTPUT||suite;
const port=process.env.QA_PORT||'5187';
export default defineConfig({
 testDir:'./qa/browser',testMatch:suite==='visual'?'**/*.visual.js':'**/*.spec.js',
 timeout:60000,expect:{timeout:5000,toHaveScreenshot:{maxDiffPixelRatio:.002,animations:'disabled'}},
 fullyParallel:true,workers:2,retries:0,
 outputDir:`qa-results/${output}/artifacts`,
 snapshotPathTemplate:'{testDir}/../baselines/{platform}/{projectName}/{testFilePath}/{arg}{ext}',
 reporter:[['list'],['json',{outputFile:`qa-results/${output}/results.json`}],['html',{outputFolder:`qa-results/${output}/html`,open:'never'}]],
 use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:8000},
 projects:[
  {name:'desktop',use:{viewport:{width:1440,height:1000}}},
  {name:'laptop',use:{viewport:{width:1366,height:768}}},
  {name:'ipad-touch',use:{viewport:{width:768,height:1024},hasTouch:true,isMobile:true,deviceScaleFactor:1}},
 ],
 webServer:{command:'node scripts/serve.js',url:`http://127.0.0.1:${port}`,env:{PORT:port},reuseExistingServer:false},
});
