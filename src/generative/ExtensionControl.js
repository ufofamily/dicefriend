import {extensionDefaults} from './settings.js';
import {peerBus} from './PeerBus.js';
// Per-preset source/target routing for the autonomous inter-preset excitation bus.
export class ExtensionControl {
 constructor(synth,_sample,_midi,save,report){
  this.synth=synth;this.save=save;this.report=report;
  const root=this.element=document.createElement('div');root.className='preset-processing peer-processing';
  root.innerHTML=`
   <fieldset><legend>Взаимные возбуждения</legend>
    <div class="processing-grid">
     <label>Режим<select data-gen="source"><option value="PEER">Взаимодействие</option><option value="OFF">Выключено</option></select></label>
     <label>Характер<select data-gen="character"><option value="AUTO">Авто · роль</option><option value="DRONE">Дрон · редкие отклики</option><option value="TEXTURE">Текстура</option><option value="PULSE">Импульс</option><option value="GROOVE">Грув</option><option value="GLITCH">Глитч</option></select></label>
     <label>Отправка <output data-value="send"></output><input data-gen="send" type="range" min="0" max="1" step=".01"></label>
     <label>Приём <output data-value="receive"></output><input data-gen="receive" type="range" min="0" max="1" step=".01"></label>
     <label>Влияние <output data-value="depth"></output><input data-gen="depth" type="range" min="0" max="1" step=".01"></label>
     <label>Плотность / с <output data-value="density"></output><input data-gen="density" type="range" min=".25" max="20" step=".25"></label>
     <label>Отклик, с <output data-value="response"></output><input data-gen="response" type="range" min=".02" max="2" step=".01"></label>
     <label>Вариация <output data-value="variation"></output><input data-gen="variation" type="range" min="0" max="1" step=".01"></label>
    </div>
    <details class="peer-sources"><summary>От каких пресетов принимать</summary><div class="peer-source-controls"></div></details>
    <p class="generator-status" role="status"></p>
   </fieldset>
   <fieldset><legend>Выходной фильтр</legend>
    <div class="processing-grid">
     <label>Тип<select data-filter="type"><option value="OFF">Выключен</option><option value="LP">LP</option><option value="HP">HP</option><option value="BP">BP</option><option value="NOTCH">Notch</option></select></label>
     <label>Частота <output data-value="cutoff"></output><input data-filter="cutoff" type="range" min="0" max="1" step=".001"></label>
     <label>Резонанс Q <output data-value="q"></output><input data-filter="q" type="range" min=".3" max="12" step=".1"></label>
     <label>Смесь <output data-value="mix"></output><input data-filter="mix" type="range" min="0" max="1" step=".01"></label>
    </div>
   </fieldset>`;
  for(const el of root.querySelectorAll('[data-filter],[data-gen]'))el.addEventListener('input',()=>{
   const s=this.synth.current(),filter=el.dataset.filter,key=filter||el.dataset.gen,group=filter?'frequencyFilter':'generative';
   let value=el.tagName==='SELECT'?el.value:Number(el.value);
   if(key==='cutoff')value=20*1000**value;
   s[group][key]=value;
   if(group==='generative')s.generative.peerModeVersion=1;
   for(const p of this.synth.instances())if(p.state.instanceId===s.instanceId)p.engine?.setExtensions(s);
   this.refresh();this.synth.onChange();save();
  });
  this.refresh();this.timer=setInterval(()=>this.status(),650);
 }
 refresh(){
  const s=this.synth.current();Object.assign(s,extensionDefaults(s));
  for(const el of this.element.querySelectorAll('[data-filter],[data-gen]')){
   const key=el.dataset.filter||el.dataset.gen,v=s[el.dataset.filter?'frequencyFilter':'generative'][key];
   if(typeof document==='undefined'||document.activeElement!==el)el.value=key==='cutoff'?Math.log(v/20)/Math.log(1000):v;
   const out=this.element.querySelector('[data-value="'+key+'"]');
   if(out)out.textContent=key==='cutoff'?Math.round(v)+' Hz':Number(v).toFixed(2);
  }
  const container=this.element.querySelector('.peer-source-controls');
  const sources=this.synth.instances().map(x=>x.state).filter(x=>x.instanceId!==s.instanceId);
  const signature=JSON.stringify([s.instanceId,s.generative.receiveFrom,sources.map(x=>[x.instanceId,x.name])]);
  if(signature===this.lastLinkSignature){this.status();return;}
  this.lastLinkSignature=signature;container.replaceChildren();
  const all=document.createElement('label'),allToggle=document.createElement('input');allToggle.type='checkbox';allToggle.checked=s.generative.receiveFrom==='ALL';
  allToggle.onchange=()=>{s.generative.receiveFrom=allToggle.checked?'ALL':sources.map(x=>x.instanceId);s.generative.peerModeVersion=1;this.sync();this.refresh()};
  all.append(allToggle,' Любой пресет');container.append(all);
  if(s.generative.receiveFrom!=='ALL')for(const src of sources){
   const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=s.generative.receiveFrom?.includes(src.instanceId);
   box.onchange=()=>{const chosen=new Set(s.generative.receiveFrom||[]);if(box.checked)chosen.add(src.instanceId);else chosen.delete(src.instanceId);s.generative.receiveFrom=[...chosen];s.generative.peerModeVersion=1;this.sync()};
   label.append(box,' '+src.name);container.append(label);
  }
  this.status();
 }
 sync(){const s=this.synth.current();this.synth.instances().find(p=>p.state.instanceId===s.instanceId)?.engine?.setExtensions(s);this.synth.onChange();this.save()}
 status(){const state=this.synth.current(),instance=this.synth.instances().find(p=>p.state.instanceId===state.instanceId);const stats=peerBus.stats(instance?.engine);const peers=this.synth.instances().filter(p=>p.state.instanceId!==state.instanceId&&p.state.generative?.source==='PEER').length;
  this.element.querySelector('.generator-status').textContent=state.generative?.source==='PEER'?`Связи: ${peers} · отправлено ${stats.sent} · принято ${stats.received}`:'Взаимодействие выключено';
 }
 prepare(){/* Autonomous events require no audio upload or MIDI file. */}
}
