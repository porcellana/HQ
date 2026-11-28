/**
 * MOTOR DE AUDIO (WebAudio, sin ficheros): música procedural con fundido cruzado, ambiente y
 * un bus para los efectos. Un único temporizador (150 ms) programa por adelantado un compás
 * cada vez: poca CPU y sin cortes. Hasta el primer toque (política de autoplay) sólo guarda
 * lo que debería sonar.
 */
import type { AmbienceDef, MusicProfile } from '@/data/schema';
import { ambientMix, barSeconds, BEATS_PER_BAR, composeBar, fanfare, midiToHz, nextEventDelay, rngFrom, type AmbientMix, type NoteEv } from './compose';

interface Track {
  profile: MusicProfile;
  seed: number;
  bar: number;
  next: number;
  bus: GainNode;
  tone: BiquadFilterNode;
  echo: GainNode;
  nodes: AudioNode[];
  dead: boolean;
}

const LOOKAHEAD = 0.6;

export class AudioEngine {
  ctx: AudioContext | null = null;
  /** Entrada de los efectos de sonido. */
  sfxBus: GainNode | null = null;
  enabled = true;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private vol = { music: 0.5, sfx: 0.5, amb: 0.5 };
  private track: Track | null = null;
  private noise: AudioBuffer | null = null;
  private night = 0;
  private intensity = 0;
  private wantMusic: { p: MusicProfile | null; seed: number; fade: number } | null = null;
  private wantAmb: AmbienceDef | undefined;
  private amb: { wind: GainNode; water: GainNode } | null = null;
  private ambNext: Record<'pajaros' | 'grillos' | 'goteo' | 'fuego', number> = { pajaros: 0, grillos: 0, goteo: 0, fuego: 0 };
  private mix: AmbientMix = ambientMix(undefined, 0);
  private rnd = rngFrom((Math.random() * 4294967296) >>> 0);
  private suspended = false;

  /** Se llama en el primer toque: crea el contexto y arranca lo pendiente. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
        const mk = (v: number) => {
          const g = ctx.createGain();
          g.gain.value = v;
          g.connect(this.master!);
          return g;
        };
        this.musicBus = mk(this.vol.music);
        this.sfxBus = mk(this.vol.sfx);
        this.ambBus = mk(this.vol.amb);
        this.applyEnabled();
        setInterval(() => this.tick(), 150);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state !== 'running' && !this.suspended) void this.ctx.resume();
    if (this.wantMusic) this.setMusic(this.wantMusic.p, this.wantMusic.seed, this.wantMusic.fade);
    this.setAmbience(this.wantAmb);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyEnabled();
  }

  /** Volúmenes por canal (0..1). */
  setVolumes(v: { music?: number; sfx?: number; amb?: number }): void {
    Object.assign(this.vol, v);
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.musicBus?.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.sfxBus?.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus?.gain.setTargetAtTime(this.vol.amb, t, 0.05);
  }

  private applyEnabled(): void {
    this.master?.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx?.currentTime ?? 0, 0.05);
  }

  /** Segundo plano: congela todo (y la CPU) hasta volver. */
  suspend(): void {
    this.suspended = true;
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    this.suspended = false;
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  setNight(n: number): void {
    this.night = n;
    this.mix = ambientMix(this.wantAmb, n);
    this.applyAmbLevels();
  }

  setIntensity(x: number): void {
    this.intensity = x;
  }

  // ------------------------------------------------------------------ música
  /** Cambia de pieza con fundido cruzado (`null` = silencio). */
  setMusic(p: MusicProfile | null, seed: number, fade = 2.5): void {
    if (this.wantMusic && this.wantMusic.p?.id === p?.id && this.track && !this.track.dead) return;
    this.wantMusic = { p, seed, fade };
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const t = ctx.currentTime;
    const old = this.track;
    if (old) {
      old.dead = true;
      old.bus.gain.cancelScheduledValues(t);
      old.bus.gain.setValueAtTime(old.bus.gain.value, t);
      old.bus.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => this.dispose(old), (fade + 0.5) * 1000);
    }
    this.track = null;
    if (!p) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + fade);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 500 + p.bright * 5500;
    tone.Q.value = 0.5;
    tone.connect(bus);
    // Eco suave (sustituye a la reverberación).
    const echo = ctx.createGain();
    echo.gain.value = 0.28;
    const dl = ctx.createDelay(1);
    dl.delayTime.value = (60 / p.tempo) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    echo.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    lp.connect(bus);
    bus.connect(this.musicBus);
    this.track = { profile: p, seed, bar: 0, next: t + 0.15, bus, tone, echo, nodes: [bus, tone, echo, dl, fb, lp], dead: false };
  }

  private dispose(tr: Track): void {
    for (const n of tr.nodes) {
      try { n.disconnect(); } catch { /* ya desconectado */ }
    }
  }

  /** Fanfarria breve; la música de fondo se apaga para dejarla sonar. */
  playFanfare(kind: 'victoria' | 'derrota'): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.setMusic(null, 0, 0.6);
    const f = fanfare(kind);
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(this.musicBus);
    const t0 = ctx.currentTime + 0.1;
    const prof = { padWave: 'triangle', leadWave: kind === 'victoria' ? 'square' : 'triangle' } as MusicProfile;
    for (const n of f.notes) this.voice(bus, prof, n, t0, 0.5);
    setTimeout(() => { try { bus.disconnect(); } catch { /* nada */ } }, (f.beats * 0.5 + 3) * 1000);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || this.suspended || ctx.state !== 'running') return;
    const tr = this.track;
    if (tr && !tr.dead) {
      if (tr.next < ctx.currentTime - 0.5) tr.next = ctx.currentTime + 0.05;
      while (tr.next < ctx.currentTime + LOOKAHEAD) {
        const opts = { night: this.night, intensity: tr.profile.style === 'marcha' ? this.intensity : 0 };
        const spb = barSeconds(tr.profile, opts) / BEATS_PER_BAR;
        for (const n of composeBar(tr.profile, tr.seed, tr.bar, opts)) this.voice(tr.tone, tr.profile, n, tr.next, spb, tr);
        tr.bar++;
        tr.next += spb * BEATS_PER_BAR;
      }
      tr.tone.frequency.setTargetAtTime((500 + tr.profile.bright * 5500) * (1 - 0.4 * this.night) * (1 + this.intensity * 0.4), ctx.currentTime, 0.5);
    }
    this.ambientEvents(ctx.currentTime);
  }

  /** Una nota con su sintetizador (osciladores con envolvente; el ruido de la percusión se comparte). */
  private voice(out: AudioNode, p: Pick<MusicProfile, 'padWave' | 'leadWave'>, n: NoteEv, t0: number, spb: number, tr?: Track): void {
    const ctx = this.ctx!;
    const t = t0 + n.t * spb;
    const dur = Math.max(0.06, n.dur * spb);
    const g = ctx.createGain();
    g.connect(out);
    if (tr && (n.voice === 'lead' || n.voice === 'arp')) {
      const s = ctx.createGain();
      s.gain.value = 0.5;
      g.connect(s);
      s.connect(tr.echo);
      tr.nodes.push(s);
      setTimeout(() => { const i = tr.nodes.indexOf(s); if (i >= 0) tr.nodes.splice(i, 1); }, (dur + 2) * 1000);
    }
    const osc = (type: OscillatorType, hz: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz;
      o.detune.value = detune;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.6);
    };
    const env = (peak: number, attack: number, rel: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + Math.max(attack, dur - rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    };
    switch (n.voice) {
      case 'pad':
        env(0.07 * n.vel, Math.min(0.9, dur * 0.4), Math.min(1.2, dur * 0.4));
        osc(p.padWave, midiToHz(n.midi), -6);
        osc(p.padWave, midiToHz(n.midi), 6);
        break;
      case 'bass':
        env(0.2 * n.vel, 0.03, 0.25);
        osc('triangle', midiToHz(n.midi));
        break;
      case 'lead':
        env(0.11 * n.vel, 0.03, 0.3);
        osc(p.leadWave, midiToHz(n.midi));
        break;
      case 'arp':
        env(0.09 * n.vel, 0.01, 0.2);
        osc('triangle', midiToHz(n.midi));
        break;
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        g.gain.setValueAtTime(0.4 * n.vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.25);
        break;
      }
      case 'snare':
      case 'hat': {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf();
        const f = ctx.createBiquadFilter();
        f.type = n.voice === 'hat' ? 'highpass' : 'bandpass';
        f.frequency.value = n.voice === 'hat' ? 7000 : 1800;
        const len = n.voice === 'hat' ? 0.05 : 0.14;
        g.gain.setValueAtTime((n.voice === 'hat' ? 0.1 : 0.2) * n.vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        src.connect(f).connect(g);
        src.start(t, this.rnd() * 0.5);
        src.stop(t + len + 0.02);
        break;
      }
    }
  }

  private noiseBuf(): AudioBuffer {
    if (this.noise) return this.noise;
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // ruido marrón (suave) para viento y agua
      d[i] = w * 0.6 + last * 6;
    }
    this.noise = buf;
    return buf;
  }

  // ----------------------------------------------------------------- ambiente
  setAmbience(a: AmbienceDef | undefined): void {
    this.wantAmb = a;
    this.mix = ambientMix(a, this.night);
    const ctx = this.ctx;
    if (!ctx || !this.ambBus) return;
    if (!this.amb) {
      const mkLoop = (hz: number, type: BiquadFilterType, q: number) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf();
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = hz;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.ambBus!);
        src.start(0, this.rnd());
        return { src, f, g };
      };
      const wind = mkLoop(420, 'bandpass', 0.6);
      const water = mkLoop(1100, 'lowpass', 0.4);
      // Ráfagas lentas: un LFO mueve el filtro del viento y el volumen del agua.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const depth = ctx.createGain();
      depth.gain.value = 220;
      lfo.connect(depth).connect(wind.f.frequency);
      lfo.start();
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.35;
      const d2 = ctx.createGain();
      d2.gain.value = 0.04;
      lfo2.connect(d2).connect(water.g.gain);
      lfo2.start();
      this.amb = { wind: wind.g, water: water.g };
    }
    this.applyAmbLevels();
  }

  private applyAmbLevels(): void {
    const a = this.amb;
    const ctx = this.ctx;
    if (!a || !ctx) return;
    a.wind.gain.setTargetAtTime(this.mix.viento * 0.22, ctx.currentTime, 1.5);
    a.water.gain.setTargetAtTime(this.mix.agua * 0.18, ctx.currentTime, 1.5);
  }

  /** Sucesos sueltos: pájaros, grillos, goteo y chasquidos de fuego (procesos de Poisson). */
  private ambientEvents(now: number): void {
    const rates = { pajaros: 0.22, grillos: 0.45, goteo: 0.5, fuego: 5 } as const;
    for (const k of ['pajaros', 'grillos', 'goteo', 'fuego'] as const) {
      const lvl = this.mix[k];
      if (lvl < 0.03) { this.ambNext[k] = now + 1; continue; }
      if (this.ambNext[k] === 0) this.ambNext[k] = now + nextEventDelay(rates[k] * lvl, this.rnd());
      if (now < this.ambNext[k]) continue;
      this.ambNext[k] = now + nextEventDelay(rates[k] * lvl, this.rnd());
      this.oneShot(k, now + 0.02, lvl);
    }
  }

  private oneShot(kind: 'pajaros' | 'grillos' | 'goteo' | 'fuego', t: number, lvl: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambBus) return;
    const r = this.rnd;
    const out = ctx.createGain();
    out.gain.value = 1;
    let node: AudioNode = out;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = r() * 1.6 - 0.8;
      out.connect(pan);
      node = pan;
    }
    node.connect(this.ambBus);
    const blip = (hz: number, to: number, at: number, len: number, peak: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(hz, at);
      o.frequency.exponentialRampToValueAtTime(to, at + len);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + len * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + len + 0.02);
    };
    let span = 0.3;
    if (kind === 'pajaros') {
      const base = 2200 + r() * 1800;
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) blip(base * (1 + 0.1 * i), base * (1.25 + r() * 0.3), t + i * 0.11, 0.08, 0.05 * lvl);
      span = n * 0.11 + 0.2;
    } else if (kind === 'grillos') {
      const base = 4200 + r() * 600;
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) blip(base, base * 0.98, t + i * 0.045, 0.03, 0.025 * lvl);
      span = n * 0.045 + 0.1;
    } else if (kind === 'goteo') {
      const hz = 900 + r() * 1100;
      blip(hz * 1.4, hz, t, 0.12, 0.09 * lvl);
      blip(hz * 1.4, hz, t + 0.19, 0.12, 0.035 * lvl);
      span = 0.5;
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800 + r() * 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1 * lvl * (0.3 + r()), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + r() * 0.04);
      src.connect(f).connect(g).connect(out);
      src.start(t, r() * 1.5);
      src.stop(t + 0.1);
      span = 0.12;
    }
    setTimeout(() => { try { node.disconnect(); out.disconnect(); } catch { /* nada */ } }, (span + 0.5) * 1000);
  }
}
