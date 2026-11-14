import { SOUND_CUES } from './combat-feedback.mjs';
type Cue = keyof typeof SOUND_CUES;
/** Original oscillator/noise effects. Context starts only from a user gesture. */
export class CombatAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<Cue, AudioBuffer>();
  private voices = 0;
  private muted = false;
  private volume = 0.5;
  private disposed = false;
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('murk-combat-audio') || '{}');
      this.muted = saved.muted === true;
      this.volume = Math.max(0, Math.min(1, Number.isFinite(saved.volume) ? saved.volume : 0.5));
    } catch {
      /* Defaults remain usable without storage. */
    }
    const mute = document.querySelector<HTMLInputElement>('#combat-mute'),
      volume = document.querySelector<HTMLInputElement>('#combat-volume');
    if (mute) mute.checked = this.muted;
    if (volume) volume.value = String(this.volume * 100);
    mute?.addEventListener('change', this.settings);
    volume?.addEventListener('input', this.settings);
    document.addEventListener('pointerdown', this.unlock);
    document.addEventListener('keydown', this.unlock);
    document.addEventListener('visibilitychange', this.visibility);
  }
  private readonly settings = (): void => {
    this.muted = document.querySelector<HTMLInputElement>('#combat-mute')?.checked ?? false;
    this.volume = Number(document.querySelector<HTMLInputElement>('#combat-volume')?.value ?? 50) / 100;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
    try {
      localStorage.setItem('murk-combat-audio', JSON.stringify({ muted: this.muted, volume: this.volume }));
    } catch {
      /* Optional preference. */
    }
  };
  private readonly unlock = (): void => {
    if (this.disposed || this.muted) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (!document.hidden) void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  };
  private readonly visibility = (): void => {
    if (document.hidden) void this.context?.suspend().catch(() => {});
  };
  play(cue: Cue): void {
    try { this.playCue(cue); } catch { /* Device/allocation failures must never block combat. */ }
  }
  private playCue(cue: Cue): void {
    const context = this.context;
    if (
      this.disposed ||
      this.muted ||
      !context ||
      context.state !== 'running' ||
      document.hidden ||
      this.voices >= 8 ||
      !this.master
    )
      return;
    let buffer = this.buffers.get(cue);
    const def = SOUND_CUES[cue];
    if (!buffer) {
      buffer = context.createBuffer(1, Math.ceil(context.sampleRate * def.duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let phase = 0,
        seed = 137;
      for (let i = 0; i < samples.length; i++) {
        const progress = i / samples.length;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        phase += (2 * Math.PI * (def.frequency + (def.end - def.frequency) * progress)) / context.sampleRate;
        samples[i] =
          (Math.sin(phase) * (1 - def.noise) + (seed / 2147483648 - 1) * def.noise) *
          Math.sin((Math.min(1, progress * 30) * Math.PI) / 2) *
          Math.exp(-progress * 6) *
          def.gain;
      }
      this.buffers.set(cue, buffer);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    this.voices++;
    source.onended = () => {
      source.disconnect();
      this.voices--;
    };
    source.start();
  }
  dispose(): void {
    this.disposed = true;
    document.removeEventListener('pointerdown', this.unlock);
    document.removeEventListener('keydown', this.unlock);
    document.removeEventListener('visibilitychange', this.visibility);
    document.querySelector('#combat-mute')?.removeEventListener('change', this.settings);
    document.querySelector('#combat-volume')?.removeEventListener('input', this.settings);
    this.master?.disconnect();
    void this.context?.close().catch(() => {});
    this.buffers.clear();
  }
}
