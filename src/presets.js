// The updated library contains ONLY the original Psycore/Slambient bank
// and new procedural DSP reconstructions derived from user-supplied reports.rar.
// Original samples are not included. Do not confuse these with native presets
// for the products that generated the analyzed audio.
import {preservedSynthPresets} from './preservedSynthPresets.js';
import {archivedSynthPresets,archivedSamplePresets} from './forensicsPresets.js';
export const synthPresets = [...preservedSynthPresets,...archivedSynthPresets];
// Clean is a utility/reset state, not a genre preset; the musical effects below
// are derived from source measurements of the analyzed archive.
export const samplePresets = [
 ['Clean / исходный',{filter:20000,highpass:20}],
 ...archivedSamplePresets
];
