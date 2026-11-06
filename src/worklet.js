import {SynthCore} from './dsp.js';
class DiceProcessor extends AudioWorkletProcessor{
 constructor(options){super();const {os,seed}=options.processorOptions;this.core=new SynthCore(sampleRate,os,seed);this.playing=false;this.alive=true;this.outputLevel=0;this.fadeUp=Math.exp(-1/(sampleRate*.006));this.fadeDown=Math.exp(-1/(sampleRate*.009));this.port.onmessage=({data:d})=>{
  if(d.type==='extensions')this.core.setExtensions(d.settings);
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
  if(this.playing&&this.core.os===3&&currentFrame%2048===0)this.port.postMessage({type:'chaos',value:Math.tanh(this.core.x/15)});
  return this.alive
 }
}
registerProcessor('dice-processor',DiceProcessor);
