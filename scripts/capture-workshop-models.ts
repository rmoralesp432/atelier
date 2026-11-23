/** Offline read-only viewport review of persisted live results, not fresh AI. */
import {readFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import express from 'express';
import {chromium,expect} from '@playwright/test';
import {createApi} from '../server/app';
import {parseSession} from '../src/intelligence/engine';
import {equalData} from '../src/projects/equalData';
const root='.cloud/workshop-campaign',out='docs/evaluations/workshop-campaign/views';mkdirSync(out,{recursive:true});
const app=createApi(null),dist='/workspace/atelier-workshop/dist';app.use(express.static(dist));app.get('/',(_q,r)=>r.sendFile(join(dist,'index.html')));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const origin=`http://127.0.0.1:${(server.address()as any).port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const requested=process.argv.slice(2);
const cases=requested.length ? requested.map(id=>{const marker=id.indexOf('-baseline-')>=0?'-baseline-':id.indexOf('-workshop-')>=0?'-workshop-':'-verifier-';return [id.slice(0,id.indexOf(marker)),id];}) : [['console-resume','console-resume-workshop-W1-edit'],['workshop-2','workshop-2-workshop-W2-edit'],['workshop-2','workshop-2-workshop-W4-edit']];
try{for(const [batch,id]of cases){
 const storage=JSON.parse(readFileSync(join(root,batch,id+'-browser.json'),'utf8'));storage.origins=storage.origins.map((o:any)=>({...o,origin}));const original=JSON.parse(readFileSync(join(root,batch,id+'-after.json'),'utf8'));
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',storageState:storage});const page=await context.newPage();await page.goto(origin);await expect(page.getByTestId('viewport')).toBeVisible({timeout:45000});
 const close=page.getByRole('button',{name:'Minimize conversation',exact:true});if(await close.isVisible())await close.click();const back=page.getByRole('button',{name:'Return to model',exact:true});if(await back.isVisible())await back.click();await page.keyboard.press('Escape');await page.waitForTimeout(1500);
 const saved=parseSession(await page.evaluate(()=>localStorage.getItem('atelier.session.v2')!));if(!equalData(saved.project.volumes,original.project.volumes))throw Error('Viewing changed geometry');await page.screenshot({path:join(out,id+'.png')});await context.close();
}}finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
