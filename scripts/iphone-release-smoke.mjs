// Evaluation-only production diagnostics. No application changes or paid API calls.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const expectedCommit='280bbc12a87d998fad3bbd87da0bada08c6196ba';
const evaluatedRef=process.env.GITHUB_SHA;
execFileSync('git',['diff','--exit-code',expectedCommit,'HEAD','--','src','server','index.html','package.json','package-lock.json','vite.config.ts']);
// Existing smoke records the deployed source, not this harness-only revision.
process.env.GITHUB_SHA=expectedCommit;
const report={expectedCommit,evaluatedRef,runtimeMatchesDeployed:true,paidCalls:0,checks:[]};
const escape=s=>String(s).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
for(const [name,file,result] of [
 ['Desktop','./smoke-render.mjs','test-results/render-smoke/result.json'],
 ['Phone','./iphone-release-phone-smoke.mjs','test-results/iphone-production-smoke/phone-smoke.json']
]){
 try{
  await import(file);
  const data=JSON.parse(fs.readFileSync(result,'utf8'));
  report.checks.push({name,status:'PASS',result:data});
  console.log(`::notice title=${name} production smoke::${escape(JSON.stringify(data))}`);
 }catch(e){
  const error=String(e.stack||e);
  report.checks.push({name,status:'FAIL',error});
  console.log(`::error title=${name} production smoke::${escape(error.slice(0,7000))}`);
 }
}
report.status=report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';
fs.mkdirSync('test-results/iphone-release',{recursive:true});
fs.writeFileSync('test-results/iphone-release/summary.json',JSON.stringify(report,null,2));
console.log(`::notice title=Production release summary::${escape(JSON.stringify(report))}`);
if(report.status!=='PASS')process.exitCode=1;
