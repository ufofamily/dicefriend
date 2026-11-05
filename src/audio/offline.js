import {routedEvents,frameEvents} from '../midi/timing.js';
import {SampleEffects} from './SampleEffects.js';
import {SynthCore} from '../dsp.js';
import {SampleProcessor} from './SampleProcessor.js';
import {MasterBus} from './MasterBus.js';
import {encodeWav} from './wav.js';
export async function offlineExport(project,buffer,seconds,sr,bits,midiFile=null){
 if(project.synth.presets.some(p=>p.generative?.source==='AUDIO')&&!buffer)throw Error('Для аудиогенерации повторно загрузите сэмпл');
 if(project.synth.presets.some(p=>p.generative?.source==='MIDI'&&(p.midi?.source==='LIVE'||!midiFile)))throw Error('Offline-генерации нужен MIDI-файл; живой вход не сохраняется');
 if(project.midiFile?.metadata&&!midiFile)throw Error('Для offline MIDI повторно выберите исходный .mid файл');
 const midi=project.midiFile;const routed=midiFile?routedEvents(midiFile,midi.routes,project.synth.presets,midi.settings):null;
 const length=Math.round(seconds*sr);const context=new OfflineAudioContext(2,length,sr),master=new MasterBus(context);master.update({...project.master,monitor:true});
 const mixed=context.createBuffer(2,length,sr),out=[mixed.getChannelData(0),mixed.getChannelData(1)];
 const clock={...project.transport,tempoMap:midiFile&&midi.settings.follow&&midi.settings.tempoMode==='FILE'?midiFile.tempos:null,at:0,beat:0,running:true};if(midiFile&&midi.settings.follow)Object.assign(clock,{loop:midi.settings.loop,loopStart:midi.settings.loopStart,loopEnd:midi.settings.loopEnd||midiFile.durationBeats});
 const l=new Float32Array(128),r=new Float32Array(128);
 let controlBuffer=null;
 if(buffer){
  // Native offline resampling puts the file on the export sample clock first.
  const resampler=new OfflineAudioContext(2,Math.ceil(buffer.duration*sr),sr),source=resampler.createBufferSource();source.buffer=buffer;source.connect(resampler.destination);source.start();const pcm=await resampler.startRendering();
  const core=new SampleProcessor(sr),p={...project.sample.params,chaos:0};if(p.mode==='FOLLOW'&&clock.source!=='FREE')p.rate=clock.bpm/p.fileBpm;core.load([pcm.getChannelData(0),pcm.getChannelData(1)]);core.configure(p);core.transport=p.mode!=='INDEPENDENT'&&clock.source!=='FREE'?clock:null;core.seek(p.reverse?Math.max(0,p.loopEnd-1/sr):p.offset);core.playing=true;
  controlBuffer=context.createBuffer(2,length,sr);const channels=[controlBuffer.getChannelData(0),controlBuffer.getChannelData(1)];
  for(let frame=0;frame<length;frame+=128){l.fill(0);r.fill(0);core.render(l,r,frame/sr);const n=Math.min(128,length-frame);channels[0].set(l.subarray(0,n),frame);channels[1].set(r.subarray(0,n),frame);if(frame%(128*2048)===0)await new Promise(resolve=>setTimeout(resolve,0))}
  const player=context.createBufferSource(),effects=new SampleEffects(context,master.input);effects.update(p);player.buffer=controlBuffer;player.connect(effects.input);player.start();
 }

 for(const preset of project.synth.presets){
  const core=new SynthCore(sr,preset.os,preset.seed);core.setExtensions(preset);core.setMode(preset.mode);preset.params.forEach((v,i)=>core.setParameter(i,v));if(midiFile){core.setMidiModulation({...preset.midi,enabled:!!routed.get(preset.instanceId)?.length});core.enqueueMidi(frameEvents(routed.get(preset.instanceId)||[],midiFile,midi.settings,clock.bpm,sr,seconds))}core.transport=preset.sync&&clock.source!=='FREE'?clock:null;
  for(let frame=0;frame<length;frame+=128){core.render(l,r,frame,controlBuffer?.getChannelData(0).subarray(frame,frame+128),controlBuffer?.getChannelData(1).subarray(frame,frame+128));for(let i=0;i<Math.min(128,length-frame);i++){out[0][frame+i]+=l[i]*preset.volume;out[1][frame+i]+=r[i]*preset.volume}if(frame%(128*2048)===0)await new Promise(resolve=>setTimeout(resolve,0))}
 }
 const synth=context.createBufferSource();synth.buffer=mixed;synth.connect(master.input);synth.start();
 const rendered=await context.startRendering();return new Blob([encodeWav([rendered.getChannelData(0),rendered.getChannelData(1)],sr,bits)],{type:'audio/wav'});
}
