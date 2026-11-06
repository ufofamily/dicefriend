// Per-voice output protection, shared by realtime AudioWorklet and offline DSP.
// This is deliberately NOT a brick-wall loudness maximizer. It gives quiet
// oscillator families limited makeup gain while retaining transient dynamics.
const TAU = Math.PI * 2;
const STAGE_GAINS = Object.freeze([
  1.4, 2, 12, 1.5, 1.7, 1, 1, 1, 1, 1, 1, 1, 1,
  1.2, 1.7, 1.9, 2.8, 1.8, 2.4, 2, 1, 1.25, 2.7, 1
]);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const limit = value => {
  // Only compress peaks above -5.2 dBFS; the linear region preserves timbre.
  const threshold = .55;
  if (value > threshold) return threshold + .28 * Math.tanh((value - threshold) / .28);
  if (value < -threshold) return -threshold + .28 * Math.tanh((value + threshold) / .28);
  return value;
};
export class OutputConditioner {
  constructor(sr, os) {
    this.sr = sr;
    this.baseGain = STAGE_GAINS[os] ?? 1;
    this.makeup = 1;
    this.power = 0;
    this.lpf = new Float64Array(4);
    // A gentle 2-pole high-frequency rolloff, not a hard lowpass. Reduce
    // oscillator aliasing/noise while leaving kick clicks and snare attacks.
    const frequency = os === 2 || os === 15 ? 9500 : os === 23 ? 13000 : 12000;
    this.alpha = 1 - Math.exp(-TAU * Math.min(frequency, sr * .42) / sr);
  }
  process(left, right) {
    const count = left.length;
    let blockPower = 0, blockPeak = 0;
    const gain = this.baseGain;
    for (let i = 0; i < count; i++) {
      const l = Number.isFinite(left[i]) ? left[i] * gain : 0;
      const r = Number.isFinite(right[i]) ? right[i] * gain : 0;
      blockPower += (l * l + r * r) * .5;
      blockPeak = Math.max(blockPeak, Math.abs(l), Math.abs(r));
    }
    blockPower /= count;
    // Do not raise makeup gain during genuine silence or at a reverb tail's
    // vanishing noise floor; otherwise the next transient would burst loudly.
    if (blockPeak > .004) {
      const rise = 1 - Math.exp(-count / (this.sr * .12));
      const fall = 1 - Math.exp(-count / (this.sr * .6));
      this.power += (blockPower - this.power) * (blockPower > this.power ? rise : fall);
      const desired = clamp(.085 / Math.max(Math.sqrt(this.power), .012), 1, 4);
      const time = desired < this.makeup ? .035 : .7;
      this.makeup += (desired - this.makeup) * (1 - Math.exp(-count / (this.sr * time)));
    }
    const level = this.baseGain * this.makeup, a = this.alpha, lp = this.lpf;
    for (let i = 0; i < count; i++) {
      // Two low-cost one-pole stages: no FFT, allocations or worker messages.
      let x = Number.isFinite(left[i]) ? left[i] * level : 0;
      lp[0] += a * (x - lp[0]);lp[1] += a * (lp[0] - lp[1]);
      left[i] = limit(lp[1]);
      x = Number.isFinite(right[i]) ? right[i] * level : 0;
      lp[2] += a * (x - lp[2]);lp[3] += a * (lp[2] - lp[3]);
      right[i] = limit(lp[3]);
    }
  }
}
