import {SampleProcessor} from './SampleProcessor.js';
class SampleWorklet extends AudioWorkletProcessor{
 constructor(){super();this.core=new SampleProcessor(sampleRate);this.alive=true;this.port.onmessage=({data:d})=>{
  if(d.type==='load')this.core.load(d.channels);
  if(d.type==='clock')this.core.transport=d.value;
  if(d.type==='params')this.core.configure(d.value);
  if(d.type==='play'){this.core.playing=true;this.core.startAt=d.at}
  if(d.type==='pause')this.core.playing=false;
  if(d.type==='seek')this.core.seek(d.position);
  if(d.type==='chaos')this.core.chaos=d.value;
  if(d.type==='dispose')this.alive=false;
 }}
 process(inputs,outputs){this.core.render(outputs[0][0],outputs[0][1],currentTime);if(currentFrame%2048===0)this.port.postMessage({position:this.core.position/sampleRate,playing:this.core.playing});return this.alive}
}
registerProcessor('sample-player',SampleWorklet);
