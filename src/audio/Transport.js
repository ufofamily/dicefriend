import {beatToSeconds,secondsToBeat} from '../midi/timing.js';
export function transportBeat(s,time){if(s.tempoMap?.length){let seconds=beatToSeconds(s.beat,s.tempoMap)+(s.running?Math.max(0,time-s.at):0);if(s.loop){const a=beatToSeconds(s.loopStart,s.tempoMap),b=beatToSeconds(s.loopEnd,s.tempoMap);if(seconds>=b&&b>a)seconds=a+(seconds-b)%(b-a)}return secondsToBeat(seconds,s.tempoMap)}const beat=s.beat+(s.running?Math.max(0,time-s.at)*s.bpm/60:0);if(s.loop&&beat>=s.loopEnd)return s.loopStart+(beat-s.loopStart)%(s.loopEnd-s.loopStart);return beat}
export function transportBpm(s,time){if(!s.tempoMap?.length)return s.bpm;const beat=transportBeat(s,time);let bpm=120;for(const t of s.tempoMap){if(t.beat>beat)break;bpm=t.bpm}return bpm}
export class Transport{
 constructor(){this.context=null;this.state={bpm:120,source:'INTERNAL',running:false,beat:0,at:0,numerator:4,denominator:4,quantization:1,loop:false,loopStart:0,loopEnd:16};this.listeners=new Set()}
 bind(context){this.context=context}
 get now(){return this.context?.currentTime||0}
 get beat(){return transportBeat(this.state,this.now)}
 get barBeats(){return this.state.numerator*4/this.state.denominator}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 notify(){for(const fn of this.listeners)fn({...this.state})}
 update(values){const beat=this.beat;Object.assign(this.state,{beat,at:this.now},values);this.notify()}
 setBpm(bpm){this.update({tempoMap:null,bpm:Math.max(1,Math.min(6000,bpm))})}
 start(reset=false){const at=this.now+.06;this.update({running:true,beat:reset?0:this.beat,at});return at}
 stop(){this.update({running:false})}
 reset(){this.update({beat:0,at:this.now+.06})}
 nextTime(){if(this.state.source==='FREE'||!this.state.running||!this.state.quantization)return this.now+.06;const q=this.state.quantization;const ahead=transportBeat({...this.state,loop:false},this.now+.06);return this.state.at+(this.state.tempoMap?.length?beatToSeconds(Math.ceil(ahead/q)*q,this.state.tempoMap)-beatToSeconds(this.state.beat,this.state.tempoMap):(Math.ceil(ahead/q)*q-this.state.beat)*60/this.state.bpm)}
 snapshot(){return {...this.state}}
}
export const transport=new Transport();
