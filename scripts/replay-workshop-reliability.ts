/** Reconstruct saved engine receipts offline. Not a browser commit or fresh AI. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {versions} from './reliability-evaluation/config';
import {oracle,pass,seed} from './reliability-evaluation/geometry';
const root='/workspace/atelier-campaign/.cloud/workshop-campaign',batch=process.argv[2],caseId=process.argv[3];
const row=JSON.parse(readFileSync(join(root,batch,'results.json'),'utf8')).find((r:any)=>r.id===caseId);assert(row&&row.status!=='RUNNING');
const version=row.commit==='16361bba915d56f1eca224c953b53a30d59bc5c9'?{path:'/workspace/atelier-reliability',commit:row.commit}:versions[row.version as keyof typeof versions];
assert.equal(version.commit,row.commit,'Replay the actual original application version');
const {applyPlan}=await import(pathToFileURL(join(version.path,'src/intelligence/engine.ts')).href);
const {verifyCompletion}=await import(pathToFileURL(join(version.path,'src/intelligence/completion.ts')).href);
const initial=JSON.parse(readFileSync(join(root,batch,caseId+'-before.json'),'utf8'));
let current=structuredClone(initial);const ids=new Map<string,string>(),events:any[]=[];
function mapScene(scene:any){
 for(const o of scene?.objects??[]){
  const found=current.project.volumes.filter((v:any)=>v.name===o.name&&(['x','y','z'].every(k=>Math.abs(v.position[k]-o.position[k])<1e-6)));
  if(found.length===1)ids.set(o.id,found[0].id);
 }
 for(const g of scene?.groups??[]){const found=current.project.groups.filter((x:any)=>x.name===g.name);if(found.length===1)ids.set(g.id,found[0].id);}
}
const sub=(x:any):any=>typeof x==='string'?(ids.get(x)??(x.startsWith('$group:')?`$group:${ids.get(x.slice(7))??x.slice(7)}`:x)):Array.isArray(x)?x.map(sub):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,sub(v)])):x;
for(const e of row.events){
 if(e.kind!=='executor')continue;mapScene(e.input.scene);
 if(!e.response?.operations?.length)continue;
 try{current=(await applyPlan(current,sub(e.response),undefined,true)).session;events.push({applied:true,operations:e.response.operations.map((op:any)=>op.type),components:current.project.volumes.length});}
 catch(error){events.push({applied:false,error:String(error)});}
}
const reports=[];
for(const e of row.events.filter((e:any)=>e.kind==='reviewer'&&e.response)){
 for(const o of e.input.candidate){const found=current.project.volumes.filter((v:any)=>v.name===o.name);if(found.length===1){ids.set(o.id,found[0].id);if(o.groupId&&found[0].groupId)ids.set(o.groupId,found[0].groupId);}}
 reports.push({label:e.input.revision?'Corrected criteria alone (does not bypass application revision policy)':'Original criteria',criteria:sub(e.response),report:await verifyCompletion(sub(e.response),initial,current)});
}
const facts=await oracle(row.task,row.edit?seed(row.task):initial,initial,current,row.edit,caseId.endsWith('edit2')?'edit2':row.edit?'edit':'create');
const out=join('docs/evaluations/workshop-reliability/recovery/live/replays');mkdirSync(out,{recursive:true});
writeFileSync(join(out,caseId+'.json'),JSON.stringify({sourceCommit:row.commit,replayCommit:version.commit,label:'Saved-response offline engine replay; IDs mapped by unique name and position. No browser commit claimed. Corrected-criteria analysis is separate from host acceptance of that correction.',events,facts,externalPass:pass(facts),reports,candidate:current},null,2));
console.log(JSON.stringify({caseId,events,externalPass:pass(facts),failed:facts.filter(f=>f.status!=='verified'),reports:reports.map(r=>({label:r.label,status:r.report.status,canCommit:r.report.canCommit}))}));
