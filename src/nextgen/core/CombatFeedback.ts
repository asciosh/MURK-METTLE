import * as THREE from 'three/webgpu';

type Position = readonly [number, number, number];
type Sound = 'shot' | 'impact' | 'punch' | 'swing' | 'reload' |
  'bandage' | 'healed' | 'hurt' | 'pickup';

interface SoundSpec {
  duration: number;
  volume: number;
  frequency: number;
  endFrequency: number;
  noise: boolean;
}

// Original synthesized sounds. No asset downloads or external audio files.
const SOUNDS: Record<Sound, SoundSpec> = {
  shot:    { duration: 0.13, volume: 0.19, frequency: 1600, endFrequency: 180, noise: true },
  impact:  { duration: 0.08, volume: 0.10, frequency: 800, endFrequency: 160, noise: true },
  punch:   { duration: 0.10, volume: 0.14, frequency: 330, endFrequency: 75, noise: true },
  swing:   { duration: 0.14, volume: 0.05, frequency: 510, endFrequency: 220, noise: true },
  reload:  { duration: 0.12, volume: 0.08, frequency: 2400, endFrequency: 500, noise: true },
  bandage: { duration: 0.22, volume: 0.04, frequency: 900, endFrequency: 450, noise: true },
  healed:  { duration: 0.24, volume: 0.06, frequency: 420, endFrequency: 660, noise: false },
  hurt:    { duration: 0.19, volume: 0.12, frequency: 160, endFrequency: 55, noise: false },
  pickup:  { duration: 0.13, volume: 0.05, frequency: 550, endFrequency: 850, noise: false }
};

class CombatAudio {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private readonly voices = new Set<AudioScheduledSourceNode>();
  private disposed = false;

  unlock(): void {
    if (this.disposed || typeof AudioContext === 'undefined') return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const buffer = this.context.createBuffer(1,
          Math.ceil(this.context.sampleRate * 0.3), this.context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.noise = buffer;
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Gameplay remains usable when the browser disallows audio.
    }
  }

  play(name: Sound): void {
    const ctx = this.context;
    if (this.disposed || !ctx || ctx.state !== 'running' || this.voices.size >= 8) return;
    const spec = SOUNDS[name];
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(spec.volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.duration);
    gain.connect(ctx.destination);
    let source: AudioScheduledSourceNode;
    let filter: BiquadFilterNode | null = null;
    if (spec.noise && this.noise) {
      const buffer = ctx.createBufferSource();
      buffer.buffer = this.noise;
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(spec.frequency, t);
      filter.frequency.exponentialRampToValueAtTime(spec.endFrequency, t + spec.duration);
      buffer.connect(filter);
      filter.connect(gain);
      source = buffer;
    } else {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(spec.frequency, t);
      oscillator.frequency.exponentialRampToValueAtTime(spec.endFrequency, t + spec.duration);
      oscillator.connect(gain);
      source = oscillator;
    }
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
    source.start(t);
    source.stop(t + spec.duration + 0.005);
  }

  reset(): void {
    for (const source of this.voices) {
      try { source.stop(); } catch { /* Already stopped. */ }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    this.voices.clear();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null;
    this.noise = null;
  }
}

interface Impact {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  remaining: number;
}

// Presentation only: one shared geometry, four reusable impact slots,
// one muzzle flash, no additional render loop or shadow-casting lights.
export class CombatFeedback {
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd080, transparent: true, opacity: 0,
    depthWrite: false, toneMapped: false
  });
  private readonly flash = new THREE.Mesh(this.geometry, this.flashMaterial);
  private readonly impacts: Impact[] = [];
  private readonly audio = new CombatAudio();
  private readonly overlay: HTMLDivElement | null;
  private flashMs = 0;
  private damageMs = 0;
  private nextImpact = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'NEXTGEN combat feedback';
    this.flash.name = 'Pistol muzzle flash';
    this.flash.visible = false;
    this.root.add(this.flash);
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xa42d22, transparent: true, opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.name = 'Combat impact ' + i;
      mesh.visible = false;
      this.root.add(mesh);
      this.impacts.push({ mesh, remaining: 0 });
    }
    this.overlay = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (this.overlay) {
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99;' +
        'background:radial-gradient(ellipse at center,transparent 45%,rgba(145,0,0,.75) 100%);opacity:0';
      document.body.appendChild(this.overlay);
    }
  }

  get needsMuzzle(): boolean { return !this.disposed && this.flashMs > 0; }

  unlockAudio(): void { this.audio.unlock(); }
  sound(name: Sound): void {
    // Audio is optional; device or context failures must not interrupt gameplay.
    try { this.audio.play(name); } catch { /* Audio unavailable. */ }
  }

  shot(): void {
    if (this.disposed) return;
    this.flashMs = 85;
    this.sound('shot');
  }

  impact(position: Position, attacker: Position, melee: boolean): void {
    if (this.disposed || !position.every(Number.isFinite) || !attacker.every(Number.isFinite)) return;
    const slot = this.impacts[this.nextImpact++ % this.impacts.length];
    const dx = attacker[0] - position[0];
    const dz = attacker[2] - position[2];
    const length = Math.hypot(dx, dz) || 1;
    // Just in front of the target's chest, on the attacker's side.
    slot.mesh.position.set(position[0] + 0.30 * dx / length,
      position[1] + 1.24, position[2] + 0.30 * dz / length);
    slot.mesh.material.color.setHex(melee ? 0xc18159 : 0xb93823);
    slot.mesh.material.opacity = 0.9;
    slot.mesh.scale.setScalar(0.12);
    slot.mesh.visible = true;
    slot.remaining = 180;
    this.sound(melee ? 'punch' : 'impact');
  }

  damage(): void {
    if (this.disposed) return;
    this.damageMs = 260;
    if (this.overlay) this.overlay.style.opacity = '0.8';
    this.sound('hurt');
  }

  update(deltaTimeMs: number, muzzle: THREE.Vector3 | null): void {
    if (this.disposed) return;
    const dt = Number.isFinite(deltaTimeMs) ? Math.max(0, deltaTimeMs) : 0;
    this.flashMs = Math.max(0, this.flashMs - dt);
    this.flash.visible = this.flashMs > 0 && muzzle !== null;
    if (this.flash.visible && muzzle) {
      this.flash.position.copy(muzzle);
      const life = this.flashMs / 85;
      this.flash.scale.setScalar(0.055 + 0.08 * life);
      this.flashMaterial.opacity = life;
    }
    for (const slot of this.impacts) {
      if (slot.remaining <= 0) continue;
      slot.remaining = Math.max(0, slot.remaining - dt);
      const life = slot.remaining / 180;
      slot.mesh.visible = life > 0;
      slot.mesh.scale.setScalar(0.12 + 0.16 * (1 - life));
      slot.mesh.material.opacity = 0.9 * life;
    }
    if (this.damageMs > 0) {
      this.damageMs = Math.max(0, this.damageMs - dt);
      if (this.overlay) this.overlay.style.opacity = String(0.8 * this.damageMs / 260);
    }
  }

  reset(): void {
    this.flashMs = this.damageMs = this.nextImpact = 0;
    this.flash.visible = false;
    for (const slot of this.impacts) {
      slot.remaining = 0;
      slot.mesh.visible = false;
    }
    if (this.overlay) this.overlay.style.opacity = '0';
    this.audio.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.audio.dispose();
    this.overlay?.remove();
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
    this.flashMaterial.dispose();
    for (const slot of this.impacts) slot.mesh.material.dispose();
  }
}
