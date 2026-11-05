import {parseMidiFile} from './MidiParser.js';self.onmessage=({data})=>{try{self.postMessage({data:parseMidiFile(data.bytes,data.name)})}catch(e){self.postMessage({error:e.message})}};
