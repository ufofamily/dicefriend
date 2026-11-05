import assert from 'node:assert/strict';
import {SynthCore} from '../src/dsp.js';
import {BassDSP} from '../src/bass-dsp.js';
import {systems, defaults, fromNorm} from '../src/parameters.js';
const l = new Float32Array(128), r = new Float32Array(128);
const check = () => {
  for (let i = 0; i < 128; i++) {
    assert(Number.isFinite(l[i]) && Number.isFinite(r[i]), 'non-finite output');
    assert(Math.abs(l[i]) <= .85 && Math.abs(r[i]) <= .85, 'output ceiling exceeded');
  }
};
for (let os = 0; os < systems.length; os++) {
  const core = new SynthCore(48000, os, 12345);
  let energy = 0, stereo = 0;
  for (let b = 0; b < 1800; b++) {
    if (b === 600) for (let i = 0; i < 12; i++) core.setParameter(i, 1);
    if (b === 1200) { core.randomize(98765); for (let i = 0; i < 12; i++) core.setParameter(i, 0); }
    core.render(l, r); check();
    for (let i = 0; i < 128; i++) { energy += l[i] ** 2 + r[i] ** 2; stereo += Math.abs(l[i] - r[i]); }
  }
  assert(energy > .01, systems[os].name + ' silent');
  assert(stereo > .01, systems[os].name + ' has no stereo field');
  const a = new SynthCore(44100, os, 77), b = new SynthCore(44100, os, 77);
  const aL = new Float32Array(128), aR = new Float32Array(128);
  for (let n = 0; n < 30; n++) { a.render(aL, aR); b.render(l, r); assert.deepEqual(aL, l); assert.deepEqual(aR, r); }
  const touch = new SynthCore(48000, os, 99); touch.setMode('TS');
  for (let n = 0; n < 30; n++) { touch.render(l, r); assert(l.every(v => v === 0) && r.every(v => v === 0), 'TS must wait for touch'); }
  touch.touch(0, .7, true); touch.touch(1, .8, true); touch.touch(2, .9, true);
  let touchEnergy = 0;
  for (let n = 0; n < 300; n++) { touch.render(l, r); check(); for (let i = 0; i < 128; i++) touchEnergy += l[i] ** 2 + r[i] ** 2; }
  assert(touchEnergy > .001, 'touch produces no excitation');
  for (let i = 0; i < 3; i++) touch.touch(i, 0, false);
  assert.equal(touch.pads.reduce((a, b) => a + b), 0);
  if (['bass','hard'].includes(systems[os].dspType)) {
    for (let n = 0; n < 7500; n++) touch.render(l, r); // 20 seconds of natural release
    assert(Math.max(...l.map(Math.abs), ...r.map(Math.abs)) < .001, 'bass voices stuck after release');
  }
  console.log('PASS ' + systems[os].name + ': bounds, stereo, seeded replay, silent TS, touch/release');
}
for (const os of systems.filter(s=>['bass','hard'].includes(s.dspType)).map(s=>s.os)) {
  const p = defaults(os).map((n, i) => fromNorm(systems[os].params[i], n));
  p[9] = 0;
  const bass = new SynthCore(48000, os, 42).bass, pads = new Float64Array(3), held = new Float64Array(3);
  let steps = 0, previous = -1;
  for (let i = 0; i < 96000; i++) {
    bass.sample(p, pads, held, true);
    if (bass.step !== previous) { steps++; previous = bass.step; }
  }
  assert(Math.abs(steps - p[0] / 60 * 4 * 2) <= 1, 'sample-clocked sequence tempo drift');
}
console.log('PASS bass sequencers: sample-clocked BPM');
