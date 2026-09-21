// Chiptune-Sound komplett aus der WebAudio-API: Rechteck-/Dreieck-Oszillatoren fuer
// Effekte, dazu ein kleiner Step-Sequencer fuer die Hintergrundmusik. Keine Dateien.
(function () {
  const PX = (window.PX = window.PX || {});

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let noiseBuf = null;

  // Sequencer-Zustand
  let track = null;
  let step = 0;
  let nextTime = 0;
  const STEP_DUR = 0.125; // 16tel bei 120 bpm

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.35;
    sfxGain.connect(master);

    const len = 4410;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, dest, when, slideTo) {
    if (!ctx) return;
    const t = when == null ? ctx.currentTime : when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterHz) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterHz || 1200;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  const SFX = {
    jump: () => tone(330, 0.16, 'square', 0.28, null, null, 760),
    land: () => noise(0.07, 0.18, 500),
    step: () => noise(0.04, 0.07, 900),
    slash: () => { noise(0.09, 0.16, 2400); tone(880, 0.08, 'sawtooth', 0.12, null, null, 420); },
    coin: () => {
      const t = ctx ? ctx.currentTime : 0;
      tone(midi(88), 0.07, 'square', 0.22, null, t);
      tone(midi(93), 0.14, 'square', 0.22, null, t + 0.06);
    },
    gem: () => {
      const t = ctx ? ctx.currentTime : 0;
      [84, 88, 91, 96].forEach((n, i) => tone(midi(n), 0.16, 'triangle', 0.2, null, t + i * 0.05));
    },
    heal: () => {
      const t = ctx ? ctx.currentTime : 0;
      [72, 76, 79].forEach((n, i) => tone(midi(n), 0.2, 'triangle', 0.22, null, t + i * 0.07));
    },
    hit: () => { noise(0.12, 0.22, 700); tone(180, 0.14, 'square', 0.18, null, null, 70); },
    hurt: () => { tone(300, 0.28, 'sawtooth', 0.26, null, null, 90); noise(0.16, 0.18, 400); },
    die: () => {
      const t = ctx ? ctx.currentTime : 0;
      [69, 64, 60, 53].forEach((n, i) => tone(midi(n), 0.26, 'square', 0.24, null, t + i * 0.13));
    },
    win: () => {
      const t = ctx ? ctx.currentTime : 0;
      [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n), 0.3, 'square', 0.24, null, t + i * 0.1));
    },
    select: () => tone(660, 0.07, 'square', 0.2),
    start: () => {
      const t = ctx ? ctx.currentTime : 0;
      [60, 67, 72].forEach((n, i) => tone(midi(n), 0.18, 'square', 0.24, null, t + i * 0.07));
    },
  };

  function sfx(name) {
    if (muted) return;
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SFX[name];
    if (fn) fn();
  }

  // ------------------------------------------------------------- Sequencer --
  const _ = null;
  const TRACKS = [
    { // Wald: freundlich, Dur
      bass: [45, _, 52, _, 45, _, 52, _, 43, _, 50, _, 41, _, 48, _],
      lead: [69, 72, 76, 72, 74, _, 71, _, 69, 72, 76, 79, 76, _, 72, _,
             67, 71, 74, 71, 72, _, 69, _, 65, 69, 72, 76, 72, _, 69, _],
    },
    { // Hoehle: dunkel, Moll
      bass: [40, _, 40, _, 47, _, 43, _, 38, _, 38, _, 45, _, 41, _],
      lead: [64, _, 67, _, 71, _, 67, _, 63, _, 67, _, 70, _, 67, _,
             62, _, 65, _, 69, _, 65, _, 60, _, 63, _, 67, _, 63, _],
    },
    { // Ruine: marschartig, heroisch
      bass: [38, 38, _, 45, 38, _, 43, _, 36, 36, _, 43, 36, _, 41, _],
      lead: [74, _, 74, 72, 70, _, 67, _, 70, _, 72, 74, 70, _, 65, _,
             72, _, 72, 70, 67, _, 65, _, 67, _, 70, 72, 67, _, 62, _],
    },
  ];

  function playTrack(i) {
    init();
    track = TRACKS[i % TRACKS.length];
    step = 0;
    nextTime = ctx ? ctx.currentTime + 0.1 : 0;
  }

  function stopTrack() {
    track = null;
  }

  // Wird jeden Frame gerufen; plant Noten ein kleines Stueck im Voraus.
  function update() {
    if (!ctx || !track || muted) return;
    const horizon = ctx.currentTime + 0.2;
    while (nextTime < horizon) {
      const b = track.bass[step % track.bass.length];
      if (b != null) tone(midi(b - 12), 0.22, 'triangle', 0.5, musicGain, nextTime);
      const l = track.lead[step % track.lead.length];
      if (l != null) tone(midi(l), 0.14, 'square', 0.22, musicGain, nextTime);
      if (step % 4 === 2 && noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, nextTime);
        g.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.05);
        src.connect(g);
        g.connect(musicGain);
        src.start(nextTime);
        src.stop(nextTime + 0.06);
      }
      nextTime += STEP_DUR;
      step++;
    }
  }

  function setMuted(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.9;
    if (!muted) unlock();
  }

  PX.audio = {
    unlock, sfx, playTrack, stopTrack, update, setMuted,
    toggle() { setMuted(!muted); return muted; },
    get muted() { return muted; },
  };
})();
