// Sample-clocked bass systems. Sub stays centred; only the upper field is spread.
const TAU = Math.PI * 2;
const SCALE = new Int8Array([0, 0, 0, 1, 5, 7, 12, -12]);
export class BassDSP {
  constructor(sr, os, seed) {
    this.sr = sr;
    this.os = os;
    this.pattern = new Int8Array(32);
    this.dronePhase = new Float64Array(6);
    this.l = this.r = 0;
    this.reset(seed);
  }
  random() {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }
  reset(seed) {
    this.seed = seed >>> 0 || 1;
    for (let i = 0; i < 32; i++) this.pattern[i] = SCALE[Math.floor(this.random() * SCALE.length)];
    this.step = -1; this.untilStep = 0; this.elapsed = 0;
    this.kickAge = this.bassAge = 100;
    this.kickPhase = this.bassPhase = this.modPhase = 0;
    this.kickAmp = this.bassAmp = 0;
    this.note = 0; this.filterA = this.filterB = 0;
    this.textureEnv = this.droneEnv = 0;
    this.dronePhase.fill(0);
  }
  silence() {
    this.kickAmp = this.bassAmp = this.textureEnv = this.droneEnv = 0;
    this.kickAge = this.bassAge = 100;
  }
  trigger(pad, pressure) {
    if (pad === 0) { this.kickAge = 0; this.kickPhase = 0; this.kickAmp = pressure; }
    if (pad === 1) { this.bassAge = 0; this.bassPhase = 0; this.note = 0; this.bassAmp = pressure; }
    if (pad === 2) this.textureEnv = Math.max(this.textureEnv, pressure);
  }
  sample(p, pads, held, autonomous, gridStep = null) {
    const sr = this.sr, dt = 1 / sr, beat = 60 / p[0], stepTime = beat / 4;
    const ritual = this.os >= 7, abyss = this.os === 8;
    this.elapsed += dt;
    this.untilStep -= dt;
    if (gridStep !== null ? gridStep !== this.lastGridStep : this.untilStep <= 0) {
      this.untilStep = gridStep !== null ? stepTime : this.untilStep + stepTime;
      this.step = gridStep !== null ? ((gridStep % 32) + 32) % 32 : (this.step + 1) % 32;
      const beatStart = this.step % 4 === 0;
      if (this.step === 0 && this.random() < (ritual ? .25 : p[6])) {
        const index = Math.floor(this.random() * 32);
        this.pattern[index] = SCALE[Math.floor(this.random() * SCALE.length)];
      }
      const kickEnabled = autonomous || pads[0] > 0;
      const bassEnabled = autonomous || pads[1] > 0;
      const kickDensity = ritual ? p[7] : 1;
      if (kickEnabled && ((beatStart && this.random() < kickDensity) ||
          (this.os === 6 && !beatStart && this.random() < p[7] * .22))) {
        this.trigger(0, autonomous ? .8 : pads[0]);
      }
      if (bassEnabled && !beatStart && (!ritual || this.random() < p[7])) {
        this.trigger(1, autonomous ? .8 : pads[1]);
        this.note = this.pattern[this.step];
        if (this.os === 5 && this.random() < p[6]) this.note += this.random() < .5 ? 1 : 7;
      }
      if (autonomous && ritual && this.step % 8 === 0) this.textureEnv = .45 + this.random() * .3;
    }
    this.lastGridStep = gridStep;
    const kickT = this.kickAge;
    // Exponential pitch sweep integrated into phase, with a short click and click-free attack.
    const sweep = Math.exp(-kickT / (ritual ? .024 : .009));
    const kickFreq = Math.min(sr * .3, p[1] * 2 ** (p[3] * sweep));
    this.kickPhase = (this.kickPhase + kickFreq * dt) % 1;
    const kickEnvelope = Math.exp(-kickT / p[2]) * Math.min(1, kickT / .0008);
    let kick = Math.sin(TAU * this.kickPhase) * kickEnvelope * this.kickAmp;
    kick += Math.sin(TAU * 3100 * kickT) * Math.exp(-kickT / .0018) * .055 * this.kickAmp;
    this.kickAge += dt;
    const bassFreq = p[1] * 2 ** (this.note / 12);
    this.bassPhase = (this.bassPhase + bassFreq * dt) % 1;
    this.modPhase = (this.modPhase + bassFreq * (this.os === 6 ? 2.003 : 1.002) * dt) % 1;
    const duck = 1 - .96 * Math.exp(-kickT / (beat * .13));
    const gateDuration = ritual ? p[4] : stepTime * p[4];
    const envelope = Math.min(1, this.bassAge / .0015) * Math.exp(-this.bassAge / (gateDuration * .38));
    const gate = ritual ? 1 : Math.max(0, Math.min(1, (gateDuration - this.bassAge) / .003));
    const bassEnvelope = envelope * gate * this.bassAmp * duck;
    this.bassAge += dt;
    const phase = TAU * this.bassPhase;
    let mono = 0, upperL = 0, upperR = 0;
    if (this.os === 5) {
      // Harmonic rolling bass: additive upper spectrum into an envelope-following two-pole filter.
      let bright = 0;
      for (let h = 2; h <= 12; h++) bright += Math.sin(phase * h) / h;
      const cutoff = Math.min(sr * .3, p[5] * (.25 + envelope * 2));
      const alpha = 1 - Math.exp(-TAU * cutoff / sr);
      this.filterA += alpha * (bright - this.filterA);
      this.filterB += alpha * (this.filterA - this.filterB);
      mono = kick * .52 + Math.sin(phase) * bassEnvelope * .36;
      const upper = this.filterB * bassEnvelope * .32;
      const spread = Math.sin(this.elapsed * 2.1) * p[9] * .25;
      upperL = upper * (1 - spread); upperR = upper * (1 + spread);
      if (this.step >= 28 && this.step % 4 !== 0) {
        upperL += Math.sin(phase * 7) * bassEnvelope * p[7] * p[9] * .07;
        upperR += Math.cos(phase * 7) * bassEnvelope * p[7] * .07;
      }
    } else if (this.os === 6) {
      // FM grows in the mids above a separate, stable sine sub.
      const motion = .4 + .6 * (.5 + .5 * Math.sin(this.elapsed * (1 + p[6] * 8)));
      const index = p[5] * motion * (.2 + envelope * .8);
      const growl = Math.sin(phase * 3 + Math.sin(TAU * this.modPhase * 2) * index);
      const ring = Math.sin(phase * 7) * Math.sin(this.elapsed * (17 + p[7] * 80));
      mono = kick * .5 + Math.sin(phase) * bassEnvelope * .32;
      upperL = (growl + ring * p[7] * .25) * bassEnvelope * .19;
      upperR = (Math.sin(phase * 3 + Math.sin(TAU * this.modPhase * 2 + p[9] * .3) * index) + ring * p[7] * .25) * bassEnvelope * .19;
    } else {
      // Shared ritual field, with distinct pulsed and sustained sub architectures.
      const tide = .5 + .5 * Math.sin(TAU * this.elapsed * p[6]);
      const desired = autonomous ? 1 : Math.min(1, pads[1] + pads[2] * .7 + (this.midiGate||0));
      this.droneEnv += (desired - this.droneEnv) * (desired > this.droneEnv ? .00015 : dt / p[4]);
      const padPitch = 1 + Math.min(4, held[2]) * .002 * pads[2];
      let darkL = 0, darkR = 0;
      for (let j = 0; j < 6; j++) {
        const ratio = j === 0 ? 1 : 2 + j * .997 + p[5] * j * .11;
        this.dronePhase[j] = (this.dronePhase[j] + p[1] * ratio * padPitch * dt * (1 + (j % 2 ? .001 : -.001) * tide)) % 1;
        const s = Math.sin(TAU * this.dronePhase[j] + p[5] * Math.sin(this.elapsed * .19 + j) * (abyss ? 3 : .7));
        if (j === 0) mono += s * this.droneEnv * (abyss ? .31 : .12) * duck;
        else {
          const weight = (abyss ? .06 : .035) / (1 + j * .4);
          darkL += s * weight * (1 - (j % 2) * p[9] * .6);
          darkR += s * weight * (1 - ((j + 1) % 2) * p[9] * .6);
        }
      }
      const fog = this.droneEnv * (.3 + tide * .7) + this.textureEnv;
      upperL = darkL * fog; upperR = darkR * fog;
      if (abyss) {
        const pulse = 1 - p[7] * .65 + p[7] * .65 * (.5 + .5 * Math.sin(TAU * this.elapsed / beat));
        mono *= pulse;
        mono += kick * .25;
      } else {
        mono += kick * .42 + Math.sin(phase) * bassEnvelope * .27;
      }
      this.textureEnv *= Math.exp(-dt / (.5 + p[4]));
    }
    // Pad III adds a high spectral accent; combinations keep the sub centred.
    if (!ritual && (pads[2] || this.textureEnv > .0001)) {
      const accent = Math.sin(phase * 9 + Math.sin(phase * 2) * 2) * Math.max(pads[2], this.textureEnv) * .08;
      upperL += accent; upperR += accent * (1 - p[9] * .5);
      this.textureEnv *= .9995;
    }
    this.l = mono + upperL;
    this.r = mono + upperR;
  }
}
