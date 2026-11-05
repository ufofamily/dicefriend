import {automate} from './automation.js';
export class MasterBus {
 constructor(context){
  this.context=context;this.settings={gain:.8,low:0,high:0,saturation:0,monitor:true};
  this.input=context.createGain();this.gain=context.createGain();this.low=context.createBiquadFilter();this.low.type='lowshelf';this.low.frequency.value=200;
  this.high=context.createBiquadFilter();this.high.type='highshelf';this.high.frequency.value=3500;
  this.shaper=context.createWaveShaper();this.shaper.oversample='2x';this.dry=context.createGain();this.wet=context.createGain();this.sum=context.createGain();
  const curve=new Float32Array(4097);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(x*3)/Math.tanh(3)}this.shaper.curve=curve;
  this.limiter=context.createDynamicsCompressor();Object.assign(this.limiter.threshold,{value:-3});this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.002;this.limiter.release.value=.12;
  this.ceiling=context.createWaveShaper();const ceiling=new Float32Array(65537);for(let i=0;i<ceiling.length;i++)ceiling[i]=Math.max(-.98,Math.min(.98,i/(ceiling.length-1)*2-1));this.ceiling.curve=ceiling;
  this.output=context.createGain();this.monitor=context.createGain();this.recordTap=context.createGain();this.meterTap=context.createChannelSplitter(2);
  this.input.connect(this.gain);this.gain.connect(this.low);this.low.connect(this.high);this.high.connect(this.dry);this.high.connect(this.shaper);this.shaper.connect(this.wet);this.dry.connect(this.sum);this.wet.connect(this.sum);this.sum.connect(this.limiter);this.limiter.connect(this.ceiling);this.ceiling.connect(this.output);
  this.output.connect(this.monitor);this.monitor.connect(context.destination);this.output.connect(this.recordTap);this.output.connect(this.meterTap);
  this.meters=[context.createAnalyser(),context.createAnalyser()];this.meters.forEach((a,i)=>{a.fftSize=2048;this.meterTap.connect(a,i)});this.data=new Float32Array(2048);this.update(this.settings);
 }
 update(settings){Object.assign(this.settings,settings);const t=this.context.currentTime,s=this.settings;automate(this.gain.gain,s.gain,t);automate(this.low.gain,s.low,t);automate(this.high.gain,s.high,t);automate(this.wet.gain,s.saturation,t);automate(this.dry.gain,1-s.saturation,t);automate(this.monitor.gain,s.monitor?1:0,t)}
 peaks(){return this.meters.map(a=>{a.getFloatTimeDomainData(this.data);let peak=0;for(const v of this.data)peak=Math.max(peak,Math.abs(v));return peak})}
}
