import {extensionDefaults,validExtensions} from './generative/settings.js';
import {validateMidiConfig} from './midi/state.js';
import {synthPresets} from './presets.js';
import {audioEngine} from './audio/AudioEngine.js';
import {transport} from './audio/Transport.js';
import {setupStudio} from './studio.js';
let studio;
import {systems,defaults,format,midiDefaults} from './parameters.js';
import defaultProject from './default-atmoslam-project.json';
import {controlPagesForPreset,readControl,formatControl,controlInactive,writeControl} from './presetControls.js';
import {buildReplacementState} from './presetReplacement.js';
import {Engine,muteSynths} from './engine.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let state={version:1,os:0,params:defaults(0),seed:freshSeed(),mode:'AS',volume:.55,fixed:false};
function validate(s){return s&&validExtensions(s)&&s.version===1&&Number.isInteger(s.os)&&s.os>=0&&s.os<systems.length&&Array.isArray(s.params)&&s.params.length===12&&s.params.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=4294967295&&['AS','TS'].includes(s.mode)&&Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=1&&typeof s.fixed==='boolean'}
try{const s=JSON.parse(localStorage.getItem('dicefriend-generative-synth'));if(validate(s))state=s;if(!state.fixed)state.seed=freshSeed()}catch{}
let engine=null,running=false,busy=false,layerIndex=0,recorder=null,chunks=[],pickup=new Map(),midiAccess=null,midiInput=null,midiOutput=null,clockTimer=null,clockLast=0,clockTimes=[],saveTimer;

let presets=[],activePreset=0,tempo=120,origin=0,lastPresetInstance=null;
function validateSession(s){return s?.version===2&&Array.isArray(s.presets)&&s.presets.length>0&&s.presets.length<=12&&s.presets.every(p=>validate(p)&&validExtensions(p)&&(p.midi===undefined||validateMidiConfig(p.midi))&&(p.instanceId===undefined||typeof p.instanceId==='string'&&p.instanceId.length<=100)&&typeof p.name==='string'&&p.name.length<=40&&typeof p.sync==='boolean')&&Number.isFinite(s.tempo)&&s.tempo>=1&&s.tempo<=6000}
function capturePreset(){if(presets[activePreset])Object.assign(presets[activePreset],{state,engine,running})}
function sessionData(){capturePreset();return {version:2,tempo,presets:presets.map(p=>p.state),activePreset}}
function loadSession(s){const states=validateSession(s)?s.presets:[s];tempo=validateSession(s)?s.tempo:120;presets=states.map((p,i)=>({state:{...extensionDefaults(p),name:p.name||'Пресет '+(i+1),sync:p.sync===true,instanceId:typeof p.instanceId==='string'?p.instanceId:crypto.randomUUID(),midi:{...midiDefaults(p.os),...p.midi}},engine:null,running:false}));for(const instance of presets){
  const current=instance.state,stored=current.presetId;
  // Migration of legacy AUDIO / MIDI / OFF project sources to the self-contained network.
  if(!current.generative.peerModeVersion){current.generative.source='PEER';current.generative.peerModeVersion=1;}
  current.midi.enabled=false;
  if(!Number.isInteger(stored))continue;
  if(synthPresets[stored]?.[0]===current.name)continue;
  const match=synthPresets.findIndex(p=>p[0]===current.name);
  if(match>=0)current.presetId=match;else delete current.presetId;
 }activePreset=Number.isInteger(s.activePreset)?Math.max(0,Math.min(presets.length-1,s.activePreset)):0;state=presets[activePreset].state;engine=null;running=false}
function loadStoredSession(){
 let saved;try{saved=JSON.parse(localStorage.getItem('dicefriend-generative-synth'))}catch{}
 // New installations start from the uploaded eight-layer ATMOSLAM project.
 // Existing user sessions take precedence and are never overwritten here.
 const initial=validateSession(saved)?saved:validateSession(defaultProject.synth)?defaultProject.synth:state;
 loadSession(initial);
}
function syncEngine(e,s){e?.sync(s.sync?{bpm:tempo,origin}:null)}
function setTempo(value){if(!Number.isFinite(value)||transport.state.source==='SAMPLE')return;transport.setBpm(value);tempo=transport.state.bpm;$('#tempo').value=tempo;save()}
function alignClock(){transport.reset()}
function selectPreset(i){if(busy||i===activePreset)return;release();diceEnd(true);keysDown.clear();capturePreset();activePreset=i;({state,engine,running}=presets[i]);pickup.clear();for(let j=0;j<12;j++)pickup.set(j,null);render();save()}
async function disposeSession(){capturePreset();await Promise.all(presets.map(p=>p.engine?.dispose()));engine=null;running=false}
function stopAll(){release();capturePreset();presets.forEach(p=>{p.engine?.stop();p.running=false});running=false;render()}
function renderSession(){
 if(!presets.length)return;capturePreset();
 $('#presetTabs').replaceChildren(...presets.map((p,i)=>{const b=document.createElement('button');b.role='tab';b.id='preset-tab-'+i;b.setAttribute('aria-controls','presetPanel');b.setAttribute('aria-selected',String(i===activePreset));b.textContent=(i===activePreset?running:p.running)?'● '+p.state.name:p.state.name;b.onclick=()=>selectPreset(i);return b}));
 studio?.extensionControl.refresh();if(state.instanceId!==lastPresetInstance){lastPresetInstance=state.instanceId;studio?.syncPresetSelector()}
 $('#presetPanel').setAttribute('aria-labelledby','preset-tab-'+activePreset);
 $('#presetName').value=state.name;$('#syncPreset').checked=state.sync;$('#tempo').value=Number(tempo.toFixed(1));$('#removePreset').disabled=presets.length===1;$('#addPreset').disabled=$('#clonePreset').disabled=presets.length>=12;
 $('#start').textContent=running?'■ СТОП ПРЕСЕТ':'▶ ПУСК ПРЕСЕТ';$('#led').classList.toggle('on',running);
 const bass=['bass','hard','slambient'].includes(systems[state.os].dspType);
 const labels=systems[state.os].touchLabels;
 const icons=bass?['◉','∿','✧']:['∿','≋','✧'];
 $$('.pad').forEach((pad,i)=>{pad.innerHTML='<span class="pad-icon" aria-hidden="true">'+icons[i]+'</span><strong>'+labels[i]+'</strong><small>'+['Z','X','C'][i]+' · удерживать</small>';pad.setAttribute('aria-label',labels[i]+', удерживайте '+['Z','X','C'][i]);pad.title=bass?['Удар кика; удержание повторяет по сетке','Басовое возбуждение; удержание поддерживает партию','Спектральный акцент или атмосфера'][i]:'Возбуждение '+(i+1)+': сочетайте площадки для изменения высоты и интенсивности';pad.setAttribute('aria-describedby','padHelp')});
 $('#padHelp').textContent=state.mode==='AS'?'AS · авто. Площадки добавляют возбуждение.':'TS · удерживайте площадки для звука.';
}
$('#presetName').oninput=e=>{state.name=e.target.value;capturePreset();save()};
$('#presetName').onchange=()=>{state.name=state.name.trim()||'Пресет';render();save()};
$('#syncPreset').onchange=e=>{state.sync=e.target.checked;syncEngine(engine,state);save();render()};
$('#tempo').onchange=e=>setTempo(Number(e.target.value));
function addPreset(copy){if(busy||presets.length>=12)return;release();capturePreset();const s=copy?{...state,params:[...state.params],name:state.name.slice(0,32)+' · копия'}:{version:1,os:0,params:defaults(0),seed:freshSeed(),mode:'AS',volume:.4,fixed:false,name:'Пресет '+(presets.length+1),sync:false};Object.assign(s,extensionDefaults(structuredClone(s)));s.generative={...s.generative,source:copy?s.generative.source:'PEER',peerModeVersion:1};s.instanceId=crypto.randomUUID();s.midi=structuredClone(s.midi||midiDefaults(s.os));presets.push({state:s,engine:null,running:false});selectPreset(presets.length-1)}
$('#addPreset').onclick=()=>addPreset(false);$('#clonePreset').onclick=()=>addPreset(true);
$('#removePreset').onclick=async()=>{if(busy||presets.length===1)return;busy=true;try{release();await engine?.dispose();presets.splice(activePreset,1);activePreset=Math.min(activePreset,presets.length-1);({state,engine,running}=presets[activePreset]);render();save()}finally{busy=false}};
$('#stopAll').onclick=stopAll;
$('#playAll').onclick=async()=>{if(busy)return;busy=true;capturePreset();try{for(const p of presets){if(!p.engine){p.engine=new Engine(p.state.os);p.engine.peerId=p.state.instanceId;await p.engine.init();p.engine.onChaos=(value)=>studio?.modulate(value);p.engine.randomize(p.state.seed);p.engine.setMode(p.state.mode);p.state.params.forEach((v,i)=>p.engine.setParameter(i,v));p.engine.volume(p.state.volume);p.engine.setExtensions(p.state);p.engine.setMidiModulation({...p.state.midi,enabled:false})}}
 ({engine}=presets[activePreset]);if(!transport.state.running)transport.start();
 const startAt=transport.nextTime();for(const p of presets){syncEngine(p.engine,p.state);await p.engine.start(startAt);p.running=true}running=true;render();return startAt;
 }catch(e){message('Audio error: '+e.message)}finally{busy=false}};
const currentLayout=()=>controlPagesForPreset(synthPresets[state.presetId]||null,state.os);
const pageIndex=()=>layerIndex;
const controlAt=j=>currentLayout().pages[pageIndex()].controls[j];
const message=t=>$('#message').textContent=t;
const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('dicefriend-generative-synth',JSON.stringify(sessionData()));studio?.save()}catch{message('Session storage is unavailable; export JSON to save.')}},200)};
function sendParam(i,v){state.params[i]=Math.max(0,Math.min(1,v));engine?.setParameter(i,state.params[i]);renderControls(true);save()}
function sendControl(control,value){
 const result=writeControl(state,control,value);
 if(result.type==='dsp')engine?.setParameter(result.index,result.value);
 else{engine?.setExtensions(state);studio?.extensionControl.refresh()}
 renderControls(true);save();
}
function apply(){engine.onChaos=(value)=>studio?.modulate(value);engine.randomize(state.seed);engine.setMode(state.mode);state.params.forEach((v,i)=>engine.setParameter(i,v));engine.volume(state.volume);engine.setExtensions(state);engine.setMidiModulation({...state.midi,enabled:false});syncEngine(engine,state)}
function syncPad(i){const active=padPointers.get(i);const pad=$$('.pad')[i];pad.classList.toggle('active',active.size>0);engine?.touch(i,active.size?Math.max(...active.values()):0,active.size>0)}
function release(){for(const pad of $$('.pad')){pad.classList.remove('active');padPointers.get(Number(pad.dataset.pad))?.clear()}for(let i=0;i<3;i++)engine?.touch(i,0,false)}
function setMode(m){release();state.mode=m;engine?.setMode(m);render();save()}
function render(){renderSession();renderControls(false)}
function renderControls(light=false){
 const sys=systems[state.os],layout=currentLayout(),page=layout.pages[pageIndex()];
 if(!light){$('#os').value=state.os;$('#subtitle').textContent=sys.subtitle;}
 if(!light){$('#seed').textContent=state.seed.toString(16).toUpperCase().padStart(8,'0');$('#fixed').checked=state.fixed;}
 if(!light)$('#modeLabel').textContent=state.mode==='AS'?'AS · Авто':'TS · Касания';
 if(!light){$('#as').classList.toggle('selected',state.mode==='AS');$('#ts').classList.toggle('selected',state.mode==='TS');}
 if(!light)$$('.control-tabbar [role="tab"]').forEach((tab,i)=>{
  const selected=i===pageIndex();
  tab.setAttribute('aria-selected',String(selected));
  tab.tabIndex=selected?0:-1;
  $('#control-page-'+i).hidden=!selected;
 });
 if(!light)$('#knobPageHelp').textContent=page.description;
 if(!light){$('#volume').value=state.volume;$('#volumeValue').textContent=Math.round(state.volume*100)+'%';}
 if(!light)$('#pickup').textContent=pickup.size?'PICKUP ARMED':'LIVE';
 (light?[$('.control-faders[data-page="'+pageIndex()+'"]')]:$$('.control-faders')).forEach(panel=>{const i=Number(panel.dataset.page);
  const controls=layout.pages[i].controls;
  [...panel.children].forEach((cell,j)=>{
   const control=controls[j];
   const slider=cell.querySelector('input[type="range"]');
   const value=readControl(state,control);
   // Avoid interrupting a drag by reassigning its active input every frame.
   if(document.activeElement!==slider || !slider.matches(':active'))slider.value=value;
   slider.setAttribute('aria-label',control.name);
   slider.setAttribute('aria-valuetext',formatControl(state,control));
   slider.title=control.help+(controlInactive(state,control)?' · включите источник/фильтр':'');
   cell.classList.toggle('fader-inactive',controlInactive(state,control));
   cell.querySelector('.control-fader-label').textContent=control.name;
   cell.querySelector('output').textContent=formatControl(state,control);
   cell.querySelector('.fader-readout').style.setProperty('--fader-fill',(value*100).toFixed(1)+'%');
  });
 });
 if(light){
  $('#parameters').querySelectorAll('.param b').forEach((el,i)=>el.textContent=format(sys.params[i],state.params[i]));
 }else $('#parameters').replaceChildren(...sys.params.map((p,i)=>{
  const el=document.createElement('div');el.className='param';const name=document.createElement('span');
  name.textContent=String(i+1).padStart(2,'0')+' '+p.name;
  const val=document.createElement('b');val.textContent=format(p,state.params[i]);el.append(name,val);return el;
 }));
}
$('#os').innerHTML=systems.map((s,i)=>'<option value="'+i+'">'+String(i+1).padStart(2,'0')+' — '+s.name+'</option>').join('');
// Real Windows-style tab pages: every page owns six persistent range inputs.
for(let page=0;page<3;page++){
 const panel=document.querySelector('.control-faders[data-page="'+page+'"]');
 for(let j=0;j<6;j++){
  const cell=document.createElement('div');cell.className='control-fader';
  const label=document.createElement('label');label.className='control-fader-label';
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='1';slider.step='0.001';
  slider.id='fader-'+page+'-'+j;
  label.htmlFor=slider.id;
  const value=document.createElement('output');value.htmlFor=slider.id;
  const readout=document.createElement('div');readout.className='fader-readout';readout.append(slider,value);
  cell.append(label,readout);panel.append(cell);
  slider.addEventListener('input',()=>{
   const control=currentLayout().pages[page].controls[j];
   pickup.delete(control.id);
   sendControl(control,Number(slider.value));
  });
  slider.addEventListener('dblclick',()=>{
   const control=currentLayout().pages[page].controls[j];
   sendControl(control,.5);
  });
  slider.addEventListener('wheel',e=>{
   e.preventDefault();
   const control=currentLayout().pages[page].controls[j];
   sendControl(control,readControl(state,control)-Math.sign(e.deltaY)*.01);
  },{passive:false});
 }
}
function setControlPage(i,focus=false){
 layerIndex=i;
 render();
 if(focus)$('#control-tab-'+i).focus();
}
$$('.control-tabbar [role="tab"]').forEach((tab,i)=>{
 tab.onclick=()=>setControlPage(i);
 tab.onkeydown=e=>{
  const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;
  e.preventDefault();
  const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowLeft'?2:1))%3;
  setControlPage(next,true);
 };
});
const padPointers=new Map([0,1,2].map(i=>[i,new Map()]));
for(const pad of $$('.pad')){const i=Number(pad.dataset.pad),active=padPointers.get(i);const update=()=>syncPad(i);pad.onpointerdown=e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);active.set(e.pointerId,e.pointerType==='mouse'?.7:e.pressure||.7);update()};pad.onpointermove=e=>{if(active.has(e.pointerId)){active.set(e.pointerId,e.pointerType==='mouse'?.7:e.pressure||.7);engine?.touch(i,active.get(e.pointerId),true)}};pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=e=>{active.delete(e.pointerId);update()};pad.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();active.set(-1,.7);update()}};pad.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){active.delete(-1);update()}}}
function randomizeSynth(allowed=Array.from({length:12},(_,i)=>i)){if(!state.fixed)state.seed=freshSeed();let x=state.seed||1;state.params=state.params.map((value,i)=>{if(!allowed.includes(i))return value;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296});engine?.randomize(state.seed);state.params.forEach((v,i)=>engine?.setParameter(i,v));pickup.clear();for(let i=0;i<12;i++)pickup.set(i,null);render();save();message('DICE · '+state.seed)}
let diceDown=0,diceTimer,wasLong=false;
function diceStart(){diceDown=performance.now();wasLong=false;$('#dice').classList.add('holding');diceTimer=setTimeout(()=>{wasLong=true;setMode(state.mode==='AS'?'TS':'AS');message('Mode changed to '+state.mode)},3000)}
function diceEnd(cancel=false){clearTimeout(diceTimer);$('#dice').classList.remove('holding');if(diceDown&&!cancel&&!wasLong&&performance.now()-diceDown<3000)studio?.dice();diceDown=0}
$('#dice').onpointerdown=e=>{e.preventDefault();$('#dice').setPointerCapture(e.pointerId);diceStart()};$('#dice').onpointerup=()=>diceEnd();$('#dice').onpointercancel=()=>diceEnd(true);$('#dice').onkeydown=e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();diceStart()}};$('#dice').onkeyup=e=>{if([' ','Enter'].includes(e.key))diceEnd()};
window.addEventListener('blur',()=>{release();keysDown.clear();diceEnd(true);render()});document.addEventListener('visibilitychange',()=>{if(document.hidden){release();keysDown.clear();diceEnd(true);render()}});
$('#as').onclick=()=>setMode('AS');$('#ts').onclick=()=>setMode('TS');
async function makeEngine(){const next=new Engine(state.os);next.peerId=state.instanceId;try{await next.init();engine=next;apply();if(running)await engine.start();else await engine.stop()}catch(e){await next.dispose().catch(()=>{});engine=null;throw e}}
$('#start').onclick=async()=>{if(busy)return;busy=true;try{if(!engine)await makeEngine();if(running){release();await engine.stop();running=false}else{if(state.sync&&!transport.state.running)transport.start();await engine.start();running=true}$('#start').textContent=running?'■ STOP AUDIO':'▶ START AUDIO';$('#led').classList.toggle('on',running);capturePreset();render();message(running?'Audio running · '+systems[state.os].name+' / '+state.mode:'Audio stopped.')}catch(e){message('Audio could not start: '+e.message)}finally{busy=false}};
$('#os').onchange=async e=>{if(busy){e.target.value=state.os;return}busy=true;release();state.os=Number(e.target.value);state.midi=midiDefaults(state.os);delete state.presetId;state.params=defaults(state.os);pickup.clear();render();try{if(engine){await engine.dispose();engine=null;await makeEngine()}save();message('OS loaded · '+systems[state.os].name)}catch(err){running=false;$('#start').textContent='▶ START AUDIO';$('#led').classList.remove('on');message('OS error: '+err.message)}finally{busy=false}};
$('#volume').oninput=e=>{state.volume=Number(e.target.value);engine?.volume(state.volume);$('#volumeValue').textContent=Math.round(state.volume*100)+'%';save()};$('#fixed').onchange=e=>{state.fixed=e.target.checked;save()};$('#infoToggle').onclick=()=>{const panel=document.querySelector('.preset-meta-workspace');if(panel){panel.scrollIntoView({behavior:'smooth',block:'nearest'});const first=panel.querySelector('.preset-meta-tab[role=tab]');first?.focus();}};
$('#seed').onclick=async()=>{try{await navigator.clipboard.writeText(String(state.seed));message('Seed copied: '+state.seed)}catch{message('Seed: '+state.seed)}};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}
$('#export').onclick=()=>download(new Blob([JSON.stringify(sessionData(),null,2)],{type:'application/json'}),'dicefriend-'+state.seed+'.json');$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(busy){message('Wait for loading');e.target.value='';return}try{if(file.size>50000)throw Error('File too large');const s=JSON.parse(await file.text());if(!validate(s)&&!validateSession(s))throw Error('Invalid state schema');if(busy)throw Error('Wait for OS loading');busy=true;release();stopRecording();await disposeSession();loadSession(s);pickup.clear();render();save();message('Session imported.')}catch(err){message('Import failed: '+err.message)}finally{busy=false;e.target.value=''}};
async function replaceCurrentPreset(index){
 if(busy)throw Error('Дождитесь завершения операции с аудио');
 const preset=synthPresets[index];if(!preset)throw Error('Пресет не найден');
 busy=true;
 let replacementEngine=null;
 try{
  release();capturePreset();
  const [name,os]=preset;
  const previous=presets[activePreset],oldState=previous.state,oldEngine=previous.engine,wasRunning=previous.running;
  const nextState=buildReplacementState(oldState,preset,index);
  if(!validate(nextState)||!validateMidiConfig(nextState.midi))throw Error('Некорректные параметры пресета');
  if(oldEngine){
   // Prepare a new voice before disposing the old one. Failure leaves old audio untouched.
   replacementEngine=new Engine(os);replacementEngine.peerId=nextState.instanceId;await replacementEngine.init();
   replacementEngine.onChaos=(value)=>studio?.modulate(value);
   replacementEngine.randomize(nextState.seed);replacementEngine.setMode(nextState.mode);
   nextState.params.forEach((v,i)=>replacementEngine.setParameter(i,v));
   replacementEngine.volume(nextState.volume);replacementEngine.setExtensions(nextState);
   replacementEngine.setMidiModulation({...nextState.midi,enabled:false});syncEngine(replacementEngine,nextState);
   if(wasRunning)await replacementEngine.start();
  }
  previous.state=nextState;previous.engine=replacementEngine;previous.running=wasRunning;
  state=nextState;engine=replacementEngine;running=wasRunning;
  layerIndex=0;pickup.clear();
  await oldEngine?.dispose().catch(()=>{});
  render();studio?.syncPresetSelector();save();
  message('Заменён пресет этой вкладки: '+name);
 }catch(error){
  // If replacement failed during preparation, the active tab retains its old state.
  await replacementEngine?.dispose().catch(()=>{});
  throw error;
 }finally{busy=false}
}
function stopRecording(){studio?.recorder.stop()}
$('#record').onclick=()=>studio?.toggleRecord();
function midiMessage(e){const [s,a,b]=e.data;if(s===248){const t=performance.now();if(clockLast&&t-clockLast<500){clockTimes.push(t-clockLast);if(clockTimes.length>24)clockTimes.shift();if(clockTimes.length===24){const bpm=60000/(clockTimes.reduce((a,b)=>a+b,0)/24*24);$('#midiStatus').textContent='CLOCK '+bpm.toFixed(1)+' BPM';setTempo(bpm)}}clockLast=t;return}if(s===250||s===251){transport.start(s===250);studio?.midi('start');capturePreset();presets.filter(p=>p.state.sync&&p.engine).forEach(p=>{p.engine.start().catch(e=>message(e.message));p.running=true;if(p===presets[activePreset])running=true});render();return}if(s===252){transport.stop();studio?.midi('stop');capturePreset();presets.filter(p=>p.state.sync).forEach(p=>{p.engine?.stop();p.running=false;if(p===presets[activePreset])running=false});release();render();return}void e}
function refreshMidi(){for(const [sel,ports] of [['#midiIn',midiAccess.inputs],['#midiOut',midiAccess.outputs]]){const el=$(sel),old=el.value;el.replaceChildren(new Option('None',''),...[...ports.values()].map(p=>new Option(p.name||p.id,p.id)));el.value=ports.has(old)?old:''}if(midiInput?.state==='disconnected'){midiInput.onmidimessage=null;midiInput=null;release();}if(midiOutput?.state==='disconnected'){midiOutput=null;clearInterval(clockTimer);$('#clockSend').checked=false}}
$('#midi').onclick=async()=>{if(!navigator.requestMIDIAccess){$('#midiStatus').textContent='Web MIDI unsupported';return}try{midiAccess=await navigator.requestMIDIAccess({sysex:false});refreshMidi();midiAccess.onstatechange=refreshMidi;$('#midiStatus').textContent='MIDI ready';$('#midi').disabled=true}catch(e){$('#midiStatus').textContent='MIDI unavailable: '+e.message}};
$('#midiIn').onchange=e=>{if(midiInput)midiInput.onmidimessage=null;release();;clockLast=0;clockTimes=[];midiInput=midiAccess?.inputs.get(e.target.value);if(midiInput)midiInput.onmidimessage=midiMessage;pickup.clear();for(let i=0;i<12;i++)pickup.set(i,null);render()};$('#midiOut').onchange=e=>{if(midiOutput&&$('#clockSend').checked)midiOutput.send([252]);midiOutput=midiAccess?.outputs.get(e.target.value);if(midiOutput&&$('#clockSend').checked)midiOutput.send([250])};$('#clockSend').onchange=e=>{clearInterval(clockTimer);if(e.target.checked){if(!midiOutput){e.target.checked=false;message('Select a MIDI output first.');return}midiOutput.send([250]);clockTimer=setInterval(()=>{try{midiOutput?.send([248])}catch{clearInterval(clockTimer)}},60000/tempo/24)}else midiOutput?.send([252])};
const keysDown=new Set();
const padKeys=['KeyZ','KeyX','KeyC'];
const decreaseKeys=['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY'];
const increaseKeys=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH'];
function editable(target){return target instanceof Element && (target.closest('input,select,textarea,[contenteditable="true"]')!==null)}
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||editable(e.target))return;
 const code=e.code;
 const pad=padKeys.indexOf(code), down=decreaseKeys.indexOf(code), up=increaseKeys.indexOf(code);
 const handled=pad>=0||down>=0||up>=0||['Space','KeyV','KeyM','KeyB','KeyI','BracketLeft','BracketRight','Minus','Equal','Escape'].includes(code);
 if(!handled)return;
 e.preventDefault();
 if(pad>=0){if(!keysDown.has(code)){keysDown.add(code);padPointers.get(pad).set(-2,.8);syncPad(pad)}return}
 if(code==='KeyV'){if(!keysDown.has(code)){keysDown.add(code);diceStart()}return}
 if(down>=0||up>=0){const control=controlAt(down>=0?down:up);pickup.delete(control.id);sendControl(control,readControl(state,control)+(down>=0?-.02:.02));return}
 if(code==='Minus'||code==='Equal'){state.volume=Math.max(0,Math.min(1,state.volume+(code==='Minus'?-.025:.025)));engine?.volume(state.volume);render();save();return}
 if(e.repeat)return;
 if(code==='Space'){if(studio?.view==='synth')$('#start').click();else studio?.toggleTransport()}
 if(code==='KeyM')setMode(state.mode==='AS'?'TS':'AS');
 if(code==='KeyB')$('#record').click();
 if(code==='KeyI')$('#infoToggle').click();
 if(code==='BracketLeft'||code==='BracketRight'){if(!busy){const os=(state.os+(code==='BracketLeft'?-1:1)+systems.length)%systems.length;$('#os').value=os;$('#os').dispatchEvent(new Event('change'))}}
 if(code==='Escape'){release();keysDown.clear();diceEnd(true);stopAll();studio?.panic();message('Panic · voices released; audio stopped.')}
});
window.addEventListener('keyup',e=>{
 const pad=padKeys.indexOf(e.code);
 if(pad>=0&&keysDown.has(e.code)){keysDown.delete(e.code);padPointers.get(pad).delete(-2);syncPad(pad)}
 if(e.code==='KeyV'&&keysDown.has(e.code)){keysDown.delete(e.code);diceEnd()}
});
const canvas=$('#scope'),ctx=canvas.getContext('2d'),samples=new Float32Array(2048);let lastScopePaint=0;function draw(now=0){requestAnimationFrame(draw);if(document.hidden||$('#presetPanel').hidden||now-lastScopePaint<(running?50:350))return;lastScopePaint=now;ctx.fillStyle='#080808';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#263120';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,80);ctx.lineTo(600,80);ctx.stroke();let peak=0;if(engine&&running){for(let channel=0;channel<2;channel++){engine.scopes[channel].getFloatTimeDomainData(samples);ctx.strokeStyle=channel?'#a1afa0':'#c6dd91';ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<600;i++){const s=samples[i*3];peak=Math.max(peak,Math.abs(s));const y=(channel?115:45)+s*40;if(i===0)ctx.moveTo(i,y);else ctx.lineTo(i,y)}ctx.stroke()}}$('#level').textContent=peak>.00001?(20*Math.log10(peak)).toFixed(1)+' dB':'−∞ dB'}loadStoredSession();render();draw();

studio=setupStudio({
 replaceCurrentPreset,
 async factory(index){if(busy)throw Error('Дождитесь загрузки');const preset=synthPresets[index];if(!preset)throw Error('Выберите пресет');const [name,os,values,meta]=preset;if(presets.length>=12)throw Error('Максимум 12 вкладок');addPreset(false);state.name=name;state.os=os;state.seed=meta.seed??freshSeed();state.volume=meta.volume??.4;state.presetId=index;state.midi=structuredClone(meta.midi||midiDefaults(os));if(meta.excitation)state.generative={...state.generative,...meta.excitation,source:'PEER',peerModeVersion:1};state.sync=false;state.params=defaults(os);for(const [key,value] of Object.entries(values))state.params[Number(key)]=value;render();save()},
 soloSample(value){muteSynths(value)},
 instances(){capturePreset();return presets},current:()=>state,onChange:save,
 getSession:sessionData,validateSession,validateLegacy:validate,
 async restore(s){if(busy)throw Error('Дождитесь загрузки пресета');release();await disposeSession();loadSession(s);render()},
 async playAll(){const at=await $('#playAll').onclick();if(!presets.every(p=>p.running))throw Error('Не удалось запустить все пресеты');return at},
 stopAll,randomize:randomizeSynth,
 names:()=>systems[state.os].params.map(p=>p.name),
 currentPreset:()=>state.presetId,
 getMidi:()=>({input:$('#midiIn').value,output:$('#midiOut').value,sendClock:$('#clockSend').checked}),
 get busy(){return busy}
});
transport.subscribe(s=>{tempo=s.bpm;$('#tempo').value=Number(tempo.toFixed(2))});
// GitHub Pages bootstrap health check: only report ready after all UI controllers loaded.
window.__ATMOSLAM_READY__ = true;
document.getElementById('atmoslam-boot-error')?.remove();

export {studio};
export {audioEngine,transport};
