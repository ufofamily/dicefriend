import {peerBus} from './generative/PeerBus.js';
import {audioEngine} from './audio/AudioEngine.js';
import {transport} from './audio/Transport.js';
import {automate} from './audio/automation.js';
const voices=new Set();let synthMuted=false,controlSource=null;
export function setControlSource(source){for(const voice of voices){if(controlSource)try{controlSource.disconnect(voice.node)}catch{}if(source)source.connect(voice.node)}controlSource=source}
export function muteSynths(value){synthMuted=value;for(const voice of voices)voice.volume(voice.requestedVolume)}
export class Engine{
 constructor(os){this.os=os;this.context=null;this.synced=false;this.requestedVolume=0}
 async init(){await audioEngine.init();this.context=audioEngine.context;this.node=new AudioWorkletNode(this.context,'dice-processor',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{os:this.os,seed:1}});this.node.port.onmessage=({data})=>{if(data.type==='peerEvent')peerBus.onEvent(this,data.event);else if(data.type==='chaos')this.onChaos?.(data.value)};this.gain=this.context.createGain();this.gain.gain.value=0;this.split=this.context.createChannelSplitter(2);this.scopes=[this.context.createAnalyser(),this.context.createAnalyser()];this.gain.connect(this.split);this.scopes.forEach((a,i)=>{a.fftSize=2048;this.split.connect(a,i)});this.node.connect(this.gain);this.gain.connect(audioEngine.master.input);this.unsubscribe=transport.subscribe(()=>this.sendClock());this.sendClock();voices.add(this);peerBus.register(this);if(controlSource)controlSource.connect(this.node)}
 async start(at){this.playing=true;await this.context.resume();this.node.port.postMessage({type:'playing',value:true,at:at??transport.nextTime()})}
 setExtensions(settings){this.peerConfig=settings.generative;this.node?.port.postMessage({type:'extensions',settings:{frequencyFilter:settings.frequencyFilter,generative:settings.generative}})}
 setMidiModulation(settings){this.node?.port.postMessage({type:'midiConfig',settings})}
 setMidiMode(mode){this.setMidiModulation({enabled:true,mode})}
 enqueueMidi(events){this.node?.port.postMessage({type:'midi',events})}
 noteOn(note,velocity,channel=0,frame=Math.ceil(this.context.currentTime*this.context.sampleRate)){this.enqueueMidi([{type:'on',note,velocity,channel,frame}])}
 noteOff(note,channel=0,frame=Math.ceil(this.context.currentTime*this.context.sampleRate)){this.enqueueMidi([{type:'off',note,channel,frame}])}
 controlChange(cc,value,channel=0,frame=Math.ceil(this.context.currentTime*this.context.sampleRate)){this.enqueueMidi([{type:'cc',cc,value,channel,frame}])}
 pitchBend(value,channel=0,frame=Math.ceil(this.context.currentTime*this.context.sampleRate)){this.enqueueMidi([{type:'bend',value,channel,frame}])}
 aftertouch(value,channel=0,frame=Math.ceil(this.context.currentTime*this.context.sampleRate)){this.enqueueMidi([{type:'aftertouch',value,channel,frame}])}
 allNotesOff(){this.node?.port.postMessage({type:'allOff'})}
 panic(){this.node?.port.postMessage({type:'panic'})}
 async stop(){this.playing=false;this.node.port.postMessage({type:'playing',value:false})}
 sync(value){this.synced=!!value;this.sendClock()}
 sendClock(){this.node?.port.postMessage({type:'sync',value:this.synced&&transport.state.source!=='FREE'?transport.snapshot():null})}
 randomize(seed){this.node.port.postMessage({type:'seed',seed})}
 setParameter(index,value){this.node.port.postMessage({type:'param',index,value})}
 setMode(mode){this.node.port.postMessage({type:'mode',mode})}
 touch(pad,pressure,active){this.node.port.postMessage({type:'touch',pad,pressure,active})}
 volume(v){this.requestedVolume=v;automate(this.gain.gain,synthMuted?0:v,this.context.currentTime)}
 async dispose(){
  voices.delete(this);peerBus.unregister(this);this.playing=false;
  if(!this.node)return;
  // Crossfade the retiring instance instead of cutting a live oscillator at
  // an arbitrary phase (the main cause of audible preset-switch pops).
  if(this.context?.state==='running'){
   const time=this.context.currentTime,param=this.gain.gain;
   param.cancelScheduledValues(time);
   param.setValueAtTime(param.value,time);
   param.linearRampToValueAtTime(0,time+.014);
   await new Promise(resolve=>setTimeout(resolve,22));
  }
  if(controlSource)try{controlSource.disconnect(this.node)}catch{}
  this.unsubscribe?.();
  this.node.port.postMessage({type:'dispose'});
  this.node.disconnect();this.split.disconnect();
  this.scopes.forEach(a=>a.disconnect());this.gain.disconnect();
 }
}
