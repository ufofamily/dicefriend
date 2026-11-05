import synthURL from '../worklet.js?worker&url';
import sampleURL from './sample-worklet.js?worker&url';
import recorderURL from './recorder-worklet.js?worker&url';
import {MasterBus} from './MasterBus.js';
import {transport} from './Transport.js';
class AudioEngine {
 async init(){if(!this.ready){this.context=new AudioContext({latencyHint:'interactive'});this.master=new MasterBus(this.context);transport.bind(this.context);this.ready=Promise.all([synthURL,sampleURL,recorderURL].map(url=>this.context.audioWorklet.addModule(url))).catch(async e=>{await this.context.close();this.ready=null;throw e})}await this.ready;return this}
 async resume(){await this.init();await this.context.resume();return this}
}
export const audioEngine=new AudioEngine();
