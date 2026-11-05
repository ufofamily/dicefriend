import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {encodeWav} from '../src/audio/wav.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.argv[2]||'playwright');
const folder=path.resolve('test-output');await fs.mkdir(folder,{recursive:true});
const sr=48000,signal=Float32Array.from({length:sr*2},(_,i)=>Math.sin(2*Math.PI*220*i/sr)*.15);
const fixture=path.join(folder,'tone.wav');await fs.writeFile(fixture,new Uint8Array(encodeWav([signal,signal],sr,24)));
const executable=process.env.BROWSER_EXECUTABLE||process.argv[3];
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{channel:'chrome'})});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:5176');
 await page.locator('[data-view=sample]').click();
 await page.locator('#sampleFile').setInputFiles(fixture);
 await page.waitForFunction(()=>document.querySelector('#sampleMetadata').textContent.includes('2.00'));
 await page.locator('#sampleMode').selectOption('MASTER');
 await page.locator('#fileBpm').fill('100');await page.locator('#fileBpm').dispatchEvent('change');
 await page.locator('[data-sample=rate]').fill('1.5');await page.locator('[data-sample=rate]').dispatchEvent('input');
 assert.equal(await page.locator('#studioBpm').inputValue(),'150');
 await page.locator('#transportStart').click();let live;for(let attempt=0;attempt<40;attempt++){await page.waitForTimeout(100);live=await page.evaluate(async()=>{const {studio,audioEngine}=await import(document.querySelector('script[src*="/src/main.js"]').src);return {peak:studio.sample.peak(),position:studio.sample.position,sameContext:studio.sample.node.context===audioEngine.context}});if(live.peak>.001&&live.position>0)break}assert(live.peak>.001&&live.position>0&&live.sameContext,JSON.stringify(live));
 await page.locator('[data-view=master]').click();await page.locator('#masterRecord').click();await page.waitForTimeout(250);
 await page.locator('[data-view=sample]').click();await page.waitForTimeout(250);
 await page.locator('[data-view=master]').click();await page.locator('#masterStopRecord').click();await page.waitForFunction(()=>document.querySelector('#recordStatus').textContent==='STOPPED');
 for(const [rate,bits] of [[44100,24],[48000,16]]){await page.locator('#wavRate').selectOption(String(rate));await page.locator('#wavBits').selectOption(String(bits));const promise=page.waitForEvent('download');await page.locator('#downloadWav').click();const download=await promise;const target=path.join(folder,'mix-'+bits+'.wav');await download.saveAs(target);const wav=await fs.readFile(target);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),rate);assert.equal(wav.readUInt16LE(34),bits);assert.equal(wav.readUInt32LE(40),wav.length-44);assert(wav.length>44+rate*2*(bits/8)*.4)}
 const freed=await page.evaluate(async()=>{const {studio}=await import(document.querySelector('script[src*="/src/main.js"]').src);return !studio.recorder.node&&studio.recorder.chunks.length===0});
 assert(freed,'recording node and PCM released');
 await page.locator('#offlineDuration').fill('1');const offline=page.waitForEvent('download');await page.locator('#offlineExport').click();await (await offline).saveAs(path.join(folder,'offline.wav'));assert.equal((await fs.stat(path.join(folder,'offline.wav'))).size,192044);
 await page.locator('#transportStop').click();
 await page.locator('[data-view=synth]').click();
 for(const [name,os] of [['Ritual psycore · Roots 210','12'],['Slambient / Short Slam','20'],['Slambient / Low Chugs','21'],['Ritual Env 01 · Atmos','22'],['TEK Perc 01 · Perc','23'],['TEK Bass I 18 · Bass','21'],['Phyllorum 16 · Texture','23'],['Phyllorum 22 · Perc','2']]){
  const option=await page.locator('#synthBank option').evaluateAll((opts,name)=>opts.find(o=>o.textContent===name)?.value,name);
  assert(option,'missing '+name);await page.locator('#synthBank').selectOption(option);
  await page.locator('#applySynthPreset').click();assert.equal(await page.locator('#os').inputValue(),os);
  await page.locator('#start').click();await page.waitForTimeout(120);assert((await page.locator('#start').innerText()).includes('СТОП'));await page.locator('#start').click();
 }
 // Same-category dice selects a different preset without creating an extra synth tab.
 await page.locator('#synthBank').selectOption(await page.locator('#synthBank option').evaluateAll(o=>o.find(x=>x.textContent==='TEK Perc 01 · Perc').value));
 const beforeRoll=await page.locator('#synthBank').inputValue(),tabCount=await page.locator('#presetTabs button').count();
 await page.locator('#rollCategoryPreset').click();
 assert.notEqual(await page.locator('#synthBank').inputValue(),beforeRoll);
 assert.equal(await page.locator('#presetTabs button').count(),tabCount);
 await page.locator('.project-menu summary').click();const exported=page.waitForEvent('download');await page.locator('#projectExport').click();const projectFile=path.join(folder,'genres-project.json');await (await exported).saveAs(projectFile);const project=JSON.parse(await fs.readFile(projectFile,'utf8'));assert(project.synth.presets.some(p=>p.os===12));assert(project.synth.presets.some(p=>p.os===23));
 await page.locator('#file').setInputFiles(projectFile);await page.waitForFunction(()=>document.querySelector('#studioStatus').textContent.includes('Проект восстановлен'));assert.equal(await page.locator('#presetTabs button').count(),9);
 await page.getByText('Темп и синхронизация',{exact:true}).click();await page.locator('#clockSource').selectOption('INTERNAL');await page.locator('#studioBpm').fill('1800');await page.locator('#studioBpm').dispatchEvent('change');assert.equal(await page.locator('#studioBpm').inputValue(),'1800');
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:844});for(const view of ['synth','sample','midi','master']){await page.locator('[data-view='+view+']').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' / '+view)}}
 assert.deepEqual(errors,[]);console.log('PASS browser: actual sample audio, shared context, sample master, recording across tabs, PCM16/24 exports, resource release, offline render, 16 responsive layouts, all genre banks, new-OS JSON roundtrip');
}finally{await browser.close()}
