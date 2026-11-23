/** Offline browser review: actual project-copy import and durable-store recovery. No AI. */
import { readFileSync,writeFileSync } from 'node:fs';
import {join} from 'node:path';
import express from 'express';
import { chromium,expect } from '@playwright/test';
import {createApi} from '../server/app';
import {parseSession} from '../src/intelligence/engine';
import {equalData} from '../src/projects/equalData';
const id=process.argv[2]??'transfer-1-workshop-W5-edit';
const modelFile=join(process.cwd(),'docs/evaluations/workshop-campaign/models',id+'.atelier.json');
const after=parseSession(readFileSync(modelFile,'utf8')),before=after.past.at(-1)!;
const app=createApi(null),dist='/workspace/atelier-workshop/dist';app.use(express.static(dist));app.get('/',(_q,r)=>r.sendFile(join(dist,'index.html')));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
const origin=`http://127.0.0.1:${(server.address() as any).port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report:any={id,kind:'Offline browser interaction with an actual committed live-result export; no fresh AI',passed:false};
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('atelier.start-direct','true'));
 await page.goto(origin);await expect(page.getByTestId('viewport')).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.getByLabel('Open project copy file',{exact:true}).setInputFiles(modelFile);
 const saved=async()=>parseSession(await page.evaluate(()=>localStorage.getItem('atelier.session.v2')!));
 await expect.poll(async()=>equalData((await saved()).project.volumes,after.project.volumes),{timeout:45000}).toBe(true);
 report.importedExactGeometry=true;
 const database=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('atelier-projects',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const rows=await new Promise<any[]>((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return rows;
 });
 const record=database.find((r:any)=>r.name===id);expect(record).toBeTruthy();expect(equalData(parseSession(record.session).project.volumes,after.project.volumes)).toBe(true);
 report.indexedDBExactGeometry=true;report.libraryProjectCount=database.length;
 await page.evaluate(()=>{for(const key of ['atelier.project.checkpoint','atelier.session.v2','atelier.conversation.v2'])localStorage.removeItem(key);});
 await page.reload();await expect(page.getByTestId('viewport')).toBeVisible({timeout:45000});
 await expect.poll(async()=>equalData((await saved()).project.volumes,after.project.volumes),{timeout:45000}).toBe(true);report.reloadFromIndexedDB=true;
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>equalData((await saved()).project.volumes,before.volumes),{timeout:30000}).toBe(true);report.undo=true;
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(async()=>equalData((await saved()).project.volumes,after.project.volumes),{timeout:30000}).toBe(true);report.redo=true;report.passed=true;
 await context.close();
}catch(e){report.error=String(e);process.exitCode=1;}finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));writeFileSync('docs/evaluations/workshop-campaign/project-import-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
