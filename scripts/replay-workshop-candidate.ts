/** Offline diagnostic: recorded operations, NOT a fresh model or application commit. */
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {applyPlan} from '../src/intelligence/engine';
import {verifyCompletion} from '../src/intelligence/completion';
import {oracle,pass} from './workshop-campaign/geometry';
import {save} from './workshop-campaign/budget';
const root='.cloud/workshop-campaign',batch=process.argv[2],id=process.argv[3];
const r=JSON.parse(readFileSync(join(root,batch,'results.json'),'utf8')).find((r:any)=>r.id===id);
const initial=JSON.parse(readFileSync(join(root,batch,id+'-before.json'),'utf8'));
let current=structuredClone(initial);const ids=new Map<string,string>(),events:any[]=[];
const substitute=(x:any):any=>typeof x==='string'?(ids.get(x)??x):Array.isArray(x)?x.map(substitute):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,substitute(v)])):x;
for(const e of r.events.filter((e:any)=>e.kind==='executor'&&e.response)){
 for(const original of e.input.scene.objects){const candidates=current.project.volumes.filter((v:any)=>v.name===original.name);if(candidates.length===1)ids.set(original.id,candidates[0].id);}
 for(const original of e.input.scene.groups??[]){const candidates=current.project.groups.filter((v:any)=>v.name===original.name);if(candidates.length===1)ids.set(original.id,candidates[0].id);}
 if(!e.response.operations?.length)continue;
 try{current=(await applyPlan(current,substitute(e.response),undefined,true)).session;events.push({message:e.response.message,applied:true,count:current.project.volumes.length});}
 catch(error){events.push({message:e.response.message,applied:false,error:String(error)});}
}
const facts=await oracle(r.task,initial,initial,current,r.edit),review=r.events.find((e:any)=>e.kind==='reviewer'&&e.response)?.response;
let originalReport,counterfactualReport,correctedChecks:any[]=[];
if(review){
 const criteria=substitute(review);originalReport=await verifyCompletion(criteria,initial,current);
 const corrected=structuredClone(criteria);
 for(const check of corrected.checks){const q=check.requirement;if(q.kind==='group'){const g=current.project.groups.find((g:any)=>g.id===q.name);if(g){correctedChecks.push({id:q.id,old:q.name,name:g.name});q.name=g.name;}}}
 if(correctedChecks.length)counterfactualReport=await verifyCompletion(corrected,initial,current);
}
mkdirSync(join(root,'replay'),{recursive:true});save(join(root,'replay',id+'-candidate.json'),current);save(join(root,'replay',id+'-diagnostic.json'),{label:'Offline replay of saved real-AI operations; no browser commit and no new AI response. IDs remapped by unique unchanged names between recorded stages.',events,facts,passedExternal:pass(facts),originalReport,counterfactual:{label:'Analysis only: group ID replaced by measured group name; not submitted to application or counted as a live pass.',correctedChecks,report:counterfactualReport}});console.log(JSON.stringify({id,events,passed:pass(facts),failed:facts.filter(f=>f.status!=='verified'),originalStatus:originalReport?.status,originalCanCommit:originalReport?.canCommit,counterfactualCanCommit:counterfactualReport?.canCommit},null,2));
