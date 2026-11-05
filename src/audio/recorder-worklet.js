class PCMRecorder extends AudioWorkletProcessor{
 constructor(){super();this.recording=false;this.count=0;this.total=0;this.capacity=8192;this.left=new Float32Array(this.capacity);this.right=new Float32Array(this.capacity);this.port.onmessage=({data:d})=>{if(d.type==='start'){this.count=0;this.total=0;this.limit=d.limit;this.recording=true}if(d.type==='stop')this.finish()}}
 flush(){if(!this.count)return;const left=this.left.slice(0,this.count),right=this.right.slice(0,this.count);this.port.postMessage({type:'chunk',left,right},[left.buffer,right.buffer]);this.count=0}
 finish(){if(!this.recording)return;this.recording=false;this.flush();this.port.postMessage({type:'stopped',frames:this.total})}
 process(inputs,outputs){if(this.recording&&inputs[0]?.[0]){const [l,r=l]=inputs[0];for(let i=0;i<l.length;i++){this.left[this.count]=l[i];this.right[this.count]=r[i];this.count++;this.total++;if(this.count===this.capacity)this.flush();if(this.total>=this.limit){this.finish();break}}}return true}
}
registerProcessor('pcm-recorder',PCMRecorder);
