import {setControlSource} from '../engine.js';
import {audioEngine} from './AudioEngine.js';
import {transport} from './Transport.js';
import {sampleDefaults} from './SampleProcessor.js';
import {SampleEffects} from './SampleEffects.js';
export class SamplePlayer{
 constructor(){this.params={...sampleDefaults};this.metadata=null;this.position=0;this.playing=false;this.loading=0;this.unsubscribe=transport.subscribe(()=>this.clockChanged())}
 async init(){await audioEngine.init();if(this.node)return;const c=audioEngine.context;this.node=new AudioWorkletNode(c,'sample-player',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});this.effects=new SampleEffects(c,audioEngine.master.input);this.node.connect(this.effects.input);setControlSource(this.node);this.node.port.onmessage=({data})=>{this.position=data.position;this.playing=data.playing};this.apply()}
 async load(file,restore=false){const token=++this.loading;if(file.size>512*1024*1024)throw Error('Файл превышает 512 МБ');await this.init();const buffer=await audioEngine.context.decodeAudioData(await file.arrayBuffer()).catch(e=>{throw Error('Браузер не смог декодировать файл. Возможны неподдерживаемый кодек, повреждение или нехватка памяти. '+e.message)});if(token!==this.loading)return false;if(buffer.duration>1800||buffer.length*2*4>768*1024*1024)throw Error('Максимум 30 минут / 768 МБ декодированного стерео');
 this.buffer=buffer;this.metadata={name:file.name,size:file.size,lastModified:file.lastModified,duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels};this.position=0;this.playing=false;
 const channels=[new Float32Array(buffer.getChannelData(0)),new Float32Array(buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1)))];this.node.port.postMessage({type:'load',channels},channels.map(c=>c.buffer));
 if(!restore)Object.assign(this.params,{loopStart:0,loopEnd:buffer.duration,offset:0});this.params.loopEnd=Math.min(buffer.duration,this.params.loopEnd||buffer.duration);this.params.loopStart=Math.min(this.params.loopStart,Math.max(0,this.params.loopEnd-.001));this.params.offset=Math.min(this.params.offset,buffer.duration);this.apply();return true}
 update(values){Object.assign(this.params,values);this.apply()}
 apply(){this.clockChanged();this.effects?.update(this.params)}
 clockChanged(){const p=this.params;if(p.mode==='MASTER'&&transport.state.source==='SAMPLE'){const bpm=p.fileBpm*p.rate*2**(p.pitch/12);if(Math.abs(transport.state.bpm-bpm)>.001)transport.setBpm(bpm)}
 const rate=p.mode==='FOLLOW'&&transport.state.source!=='FREE'?transport.state.bpm/p.fileBpm:p.rate;
 this.node?.port.postMessage({type:'params',value:{...p,rate}});this.node?.port.postMessage({type:'clock',value:p.mode!=='INDEPENDENT'&&transport.state.source!=='FREE'?transport.snapshot():null});
 }
 async play(at){if(!this.buffer)throw Error('Сначала выберите аудиофайл');await audioEngine.resume();if(!this.playing&&this.position===0)this.seek(this.params.reverse?(this.params.loopEnd||this.buffer.duration)-1/audioEngine.context.sampleRate:this.params.offset);this.node.port.postMessage({type:'play',at:at??(this.params.mode==='INDEPENDENT'?audioEngine.context.currentTime+.03:transport.nextTime())});this.playing=true}
 pause(){this.node?.port.postMessage({type:'pause'});this.playing=false}
 stop(){this.pause();this.seek(this.params.reverse?Math.max(0,this.params.loopEnd-.001):this.params.offset)}
 seek(position){this.position=Math.max(0,Math.min(this.buffer?.duration||0,position));this.node?.port.postMessage({type:'seek',position:this.position})}
 peak(){return this.effects?.peak()||0}
 clear(){setControlSource(null);this.pause();this.node?.port.postMessage({type:'dispose'});this.node?.disconnect();this.effects?.dispose();this.effects=null;this.node=null;this.buffer=null;this.position=0;this.loading++}

}
