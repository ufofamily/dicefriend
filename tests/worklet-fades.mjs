import assert from 'node:assert/strict';
globalThis.sampleRate=48000;
globalThis.currentFrame=0;
globalThis.AudioWorkletProcessor=class {constructor(){this.port={onmessage:null,postMessage(){}}}};
globalThis.registerProcessor=(name,clazz)=>{if(name==='dice-processor')globalThis.WorkletClass=clazz};
await import('../src/worklet.js');
const p=new globalThis.WorkletClass({processorOptions:{os:20,seed:200}});
const left=new Float32Array(128),right=new Float32Array(128);
const send=data=>p.port.onmessage({data});
const process=()=>{p.process([] ,[[left,right]]);globalThis.currentFrame+=128};
send({type:'playing',value:true,at:0});
let maxLevel=0;for(let i=0;i<140;i++){process();maxLevel=Math.max(maxLevel,...left.map(x=>Math.abs(x)));}
assert(maxLevel>.03,'audible output was not emitted');
send({type:'playing',value:false});
let first=Math.abs(p.outputLevel);for(let i=0;i<30;i++)process();
assert(first>.2);assert(p.outputLevel<.001,'stop was not faded to silence');
assert(left.every(v=>Math.abs(v)<.001),'output not silent after stop');
console.log('PASS worklet: fade-in, fade-out, stopped silence');
