import {migrateMidiProject,validateMidiProject} from '../midi/state.js';
export const migrateProject=migrateMidiProject;
import {sampleDefaults} from './SampleProcessor.js';
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export function validateProject(p,validateSession){
 p=migrateProject(p);if(!p||p.version!==4||!validateSession(p.synth)||!validateMidiProject(p))return false;
 const t=p.transport,s=p.sample?.params,m=p.master;
 if(!t||!['INTERNAL','SAMPLE','FREE'].includes(t.source)||!finite(t.bpm,1,6000)||!finite(t.beat,0,1e9)||!Number.isInteger(t.numerator)||!finite(t.numerator,1,12)||![2,4,8,16].includes(t.denominator)||![0,.25,1,4].includes(t.quantization)||typeof t.loop!=='boolean'||!finite(t.loopStart,0,1e6)||!finite(t.loopEnd,t.loopStart+.25,1e6))return false;
 if(!s||!['INDEPENDENT','FOLLOW','MASTER'].includes(s.mode)||typeof s.reverse!=='boolean'||typeof s.loop!=='boolean'||typeof s.muted!=='boolean')return false;
 const ranges={volume:[0,1],pan:[-1,1],rate:[.25,4],pitch:[-24,24],offset:[0,1800],loopStart:[0,1800],loopEnd:[0,1800],filter:[40,20000],stutter:[0,1],grainSize:[.01,.5],density:[0,80],fileBpm:[30,360],chaos:[0,1],highpass:[20,2000],resonance:[.1,15],drive:[0,1],delayTime:[.02,2],delayFeedback:[0,.85],delayMix:[0,1],attack:[.005,1],release:[.005,2]};
 for(const [k,r] of Object.entries(ranges))if(!finite(s[k],...r))return false;
 if(s.loopEnd&&s.loopEnd<=s.loopStart)return false;
 if(!m||!finite(m.gain,0,1.5)||!finite(m.low,-18,18)||!finite(m.high,-18,18)||!finite(m.saturation,0,1)||typeof m.monitor!=='boolean')return false;
 const metadata=p.sample.metadata;if(metadata!==null&&(!metadata||typeof metadata.name!=='string'||metadata.name.length>512||!finite(metadata.duration,0,1800)))return false;
 if(!p.random||!['SELECTED','BOTH'].includes(p.random.mode)||!Array.isArray(p.random.synth)||p.random.synth.some(i=>!Number.isInteger(i)||i<0||i>11)||!Array.isArray(p.random.sample)||p.random.sample.some(k=>!['volume','pan','rate','pitch','filter','stutter','grainSize','density','highpass','resonance','drive','delayTime','delayFeedback','delayMix','attack','release'].includes(k)))return false;
 if(!p.midi||typeof p.midi.input!=='string'||typeof p.midi.output!=='string'||typeof p.midi.sendClock!=='boolean')return false;
 return true;
}
export function createProject(synth,transport,sample,master,random,midi,midiFile){return {version:4,synth,midiFile,transport:{...transport.snapshot(),beat:transport.beat,running:false,at:0,tempoMap:null},sample:{params:{...sampleDefaults,...sample.params},metadata:sample.metadata},master:{...master},random,midi,recording:{restored:false,note:'PCM is not embedded; recording is never resumed automatically'}}}
