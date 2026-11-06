import {SynthCore} from './dsp.js';
class DiceProcessor extends AudioWorkletProcessor{
 constructor(options){super();const {os,seed}=options.processorOptions;this.core=new SynthCore(sampleRate,os,seed);this.playing=false;this.alive=true;this.outputLevel=0;this.fadeUp=Math.exp(-1/(sampleRate*.006));this.fadeDown=Math.exp(-1/(sampleRate*.009));this.lastPeerFrame=-1e9;this.lastEmitFrame=-1e9;this.fastEnergy=0;this.slowEnergy=0;this.lastSourceFrame=-1e9;this.lastNativeFrame=-1e9;this.port.onmessage=({data:d})=>{
  if(d.type==='extensions')this.core.setExtensions(d.settings);
  if(d.type==='peerExcite'&&this.playing&&this.core.receivePeer(d.event))this.lastPeerFrame=currentFrame;
  if(d.type==='midi')this.core.enqueueMidi(d.events);
  if(d.type==='midiConfig')this.core.setMidiModulation(d.settings);
  if(d.type==='allOff')this.core.allNotesOff();
  if(d.type==='panic')this.core.panic();
  if(d.type==='param')this.core.setParameter(d.index,d.value);
  if(d.type==='seed')this.core.randomize(d.seed);
  if(d.type==='mode')this.core.setMode(d.mode);
  if(d.type==='touch')this.core.touch(d.pad,d.pressure,d.active);
  if(d.type==='playing'){if(!d.value)this.core.allNotesOff();this.playing=d.value;this.startAt=d.at||0;this.core.startFrame=Math.round(this.startAt*sampleRate);}
  if(d.type==='sync')this.core.transport=d.value;
  if(d.type==='dispose')this.alive=false;
 }}
 process(inputs,outputs){
  const left=outputs[0][0],right=outputs[0][1];
  const scheduled=this.playing&&(currentFrame+left.length)/sampleRate>this.startAt;
  if(scheduled||this.outputLevel>.0001){
   this.core.render(left,right,currentFrame,inputs[0]?.[0],inputs[0]?.[1]||inputs[0]?.[0]);
   for(let i=0;i<left.length;i++){
    const target=this.playing&&currentFrame+i>=this.core.startFrame?1:0;
    this.outputLevel=target+(this.outputLevel-target)*(target?this.fadeUp:this.fadeDown);
    left[i]*=this.outputLevel;right[i]*=this.outputLevel;
   }
  }else{left.fill(0);right.fill(0)}
  // Rate-limited musical events from actual DSP attacks, not a routed audio cable.
  // A received event cannot be re-broadcast immediately: one-hop routing avoids
  // self-sustaining feedback when several synths listen to one another.
  if(scheduled&&this.core.generator.settings.source==='PEER'){
   let rms=0,brightness=0;
   for(let i=0;i<left.length;i+=4){const v=(left[i]+right[i])*.5;const d=(left[i]-right[i])*.5;rms+=v*v;brightness+=d*d}
   rms=Math.sqrt(rms/Math.ceil(left.length/4));
   const a=Math.exp(-left.length/(sampleRate*.023)),b=Math.exp(-left.length/(sampleRate*.27));
   this.fastEnergy=this.fastEnergy*a+rms*(1-a);this.slowEnergy=this.slowEnergy*b+rms*(1-b);
   const native=this.core.outboundEvent;this.core.outboundEvent=null;
   const spontaneous=rms>.015&&this.fastEnergy>this.slowEnergy*1.9&&this.fastEnergy>.018;
   const fresh=currentFrame-this.lastEmitFrame>sampleRate*.095;
   // Source-initiated triggers remain eligible even while responding to another layer.
   // Only audio-onset fallback (which may be caused by a received event) is suppressed.
   const original=currentFrame-this.lastPeerFrame>sampleRate*.25;
   const sustained=rms>.025&&currentFrame-this.lastEmitFrame>sampleRate*1.5;
   if(fresh&&(native||(original&&(spontaneous||sustained)))){
    this.lastEmitFrame=currentFrame;
    this.port.postMessage({type:'peerEvent',event:{pad:native?.pad??2,velocity:Math.min(.95,Math.max(.18,native?.velocity??rms*2.5)),brightness:Math.min(1,Math.max(0,brightness/(brightness+rms*rms+1e-7)*2)),pitch:.5,frame:currentFrame}});
   }
  }else this.core.outboundEvent=null;
  if(this.playing&&this.core.os===3&&currentFrame%2048===0)this.port.postMessage({type:'chaos',value:Math.tanh(this.core.x/15)});
  return this.alive
 }
}
registerProcessor('dice-processor',DiceProcessor);
