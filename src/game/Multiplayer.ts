export interface RemotePlayer { id: string; x: number; z: number; yaw: number; hp: number; }
export interface RemoteZombie { x: number; z: number; hp: number; max: number; strain: string; generation: number; }
export type RoomEvent = { type: 'welcome'; id: string; code: string } | { type: 'snapshot'; players: RemotePlayer[]; zombie: RemoteZombie } | { type: 'damage'; hp: number } | { type: 'kill'; by: string; pulse: boolean; x: number; z: number } | { type: 'reward'; xp: number; creatureXp: number; material?: string | null; duplicate: boolean; totals: { xp: number; kills: number; creatureXp: number } } | { type: 'creature-state'; owned: boolean; xp: number } | { type: 'error'; message: string };
type Frame = { at: number; players: RemotePlayer[]; zombie: RemoteZombie };
const INTERPOLATION_DELAY_MS = 120;
const blend = (a: number, b: number, t: number): number => a + (b - a) * t;
function yawBlend(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}
export class Multiplayer {
  private ws: WebSocket | null = null;
  private frames: Frame[] = [];
  id = '';
  code = '';
  connected = false;
  readonly peers = new Map<string, RemotePlayer>();
  zombie: RemoteZombie | null = null;
  onEvent: (event: RoomEvent) => void = () => {};
  connect(code: string): void {
    this.disconnect();
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/room?code=${encodeURIComponent(code)}`);
    this.ws = socket;
    socket.onmessage = event => {
      if (this.ws !== socket) return;
      try {
        const data = JSON.parse(event.data as string) as RoomEvent;
        if (data.type === 'welcome') { this.id = data.id; this.code = data.code; this.connected = true; this.send('sync-equipment'); }
        if (data.type === 'snapshot') {
          this.frames.push({ at: performance.now(), players: data.players, zombie: data.zombie });
          if (this.frames.length > 5) this.frames.shift();
        }
        this.onEvent(data);
      } catch { /* invalid packet ignored */ }
    };
    socket.onclose = () => { if (this.ws === socket) { this.resetConnection(); this.onEvent({ type: 'error', message: 'Room disconnected. Solo mode resumed.' }); } };
    socket.onerror = () => { if (this.ws === socket) this.onEvent({ type: 'error', message: 'Unable to connect to the room server. Check the deployment and room code.' }); };
  }
  // Deliberately run from the render loop, not the WebSocket event callback.
  // Holding the newest state briefly gives us two samples to interpolate instead of snapping.
  updateVisuals(): void {
    if (!this.frames.length) return;
    const target = performance.now() - INTERPOLATION_DELAY_MS;
    const last = this.frames[this.frames.length - 1];
    let a = this.frames[0];
    let b = last;
    for (let i = 1; i < this.frames.length; i++) {
      if (this.frames[i].at >= target) { b = this.frames[i]; a = this.frames[i-1]; break; }
      a = this.frames[i];
    }
    const alpha = a === b ? 1 : Math.max(0, Math.min(1, (target - a.at) / Math.max(1, b.at - a.at)));
    this.peers.clear();
    for (const next of b.players) {
      if (next.id === this.id) continue;
      const previous = a.players.find(p => p.id === next.id);
      if (!previous) { this.peers.set(next.id, next); continue; }
      this.peers.set(next.id, { ...next,
        x: blend(previous.x, next.x, alpha), z: blend(previous.z, next.z, alpha),
        yaw: yawBlend(previous.yaw, next.yaw, alpha) });
    }
    if (a.zombie.generation !== b.zombie.generation) this.zombie = b.zombie;
    else this.zombie = { ...b.zombie, x: blend(a.zombie.x, b.zombie.x, alpha), z: blend(a.zombie.z, b.zombie.z, alpha) };
  }
  send(type: string, body: Record<string, unknown> = {}): void {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, ...body }));
  }
  private resetConnection(): void {
    this.connected = false; this.id = ''; this.code = ''; this.peers.clear(); this.zombie = null; this.frames = [];
  }
  disconnect(): void { this.ws?.close(); this.ws = null; this.resetConnection(); }
}
