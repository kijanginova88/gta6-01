// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum follows the driven car's speed, sirens wail two-tone, and a tiny
// step sequencer plays a bassline over the title and the streets.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** Call from a user gesture (start button / first key) so the browser allows sound. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    return !!c;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = c.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  const BASSLINE = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 0, 65.41, 49];

  function musicTick() {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const note = BASSLINE[musicStep % BASSLINE.length];
    musicStep += 1;
    if (note) tone(note, 0.22, 'triangle', 0.09);
    if (musicStep % 4 === 1) tone(220, 0.06, 'square', 0.03);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (muted) this.engine(0);
    },
    isMuted() {
      return muted;
    },
    startMusic() {
      if (musicTimer || !ensure()) return;
      musicTimer = window.setInterval(musicTick, 240);
    },
    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    /** Engine hum: speed 0..1. Call every frame while driving, 0 otherwise. */
    engine(speed) {
      if (muted || speed <= 0.02) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch { /* already stopped */ }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = c.createGain();
        engineGain.gain.value = 0.045;
        engineOsc.connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.setValueAtTime(60 + speed * 140, c.currentTime);
      engineGain.gain.setValueAtTime(0.02 + speed * 0.05, c.currentTime);
    },
    siren() {
      tone(700, 0.28, 'sine', 0.05, 950);
      window.setTimeout(() => tone(950, 0.28, 'sine', 0.05, 700), 280);
    },
    gunshot() {
      noise(0.12, 0.3, 2400);
    },
    punch() {
      noise(0.08, 0.2, 700);
    },
    crash() {
      noise(0.25, 0.3, 500);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12);
      window.setTimeout(() => tone(1318, 0.12, 'sine', 0.12), 90);
    },
    cash() {
      tone(1046, 0.08, 'sine', 0.1);
      window.setTimeout(() => tone(1568, 0.14, 'sine', 0.1), 80);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, 'triangle', 0.12), i * 110));
    },
    busted() {
      [392, 311, 233].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'sawtooth', 0.1), i * 180));
    },
  };
}
