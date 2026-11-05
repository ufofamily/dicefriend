import {encodeWav} from './wav.js';
self.onmessage=({data})=>{try{const buffer=encodeWav(data.channels,data.sampleRate,data.bits);self.postMessage({buffer},[buffer])}catch(e){self.postMessage({error:e.message})}};
