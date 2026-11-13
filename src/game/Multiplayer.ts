export interface RemotePlayer { id: string; x: number; z: number; yaw: number; hp: number; }
export interface RemoteZombie { x: number; z: number; hp: number; max: number; strain: string; generation: number; }
export type RoomEvent = { type: 'welcome'; id: string; code: string } | { type: 'snapshot'; players: RemotePlayer[]; zombie: RemoteZombie } | { type: 'damage'; hp: number } | { type: 'kill'; by: string; pulse: boolean; x: number; z: number } | { type: 'error'; message: string };
export class Multiplayer {
  private ws: WebSocket | null = null;
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
        if (data.type === 'welcome') { this.id = data.id; this.code = data.code; this.connected = true; }
        if (data.type === 'snapshot') { this.peers.clear(); for (const p of data.players) if (p.id !== this.id) this.peers.set(p.id, p); this.zombie = data.zombie; }
        this.onEvent(data);
      } catch { /* bad packet ignored */ }
    };
    socket.onclose = () => { if (this.ws === socket) { this.connected = false; this.id = ''; this.code = ''; this.peers.clear(); this.zombie = null; this.onEvent({ type: 'error', message: 'Room disconnected. Solo mode resumed.' }); } };
    socket.onerror = () => { if (this.ws === socket) this.onEvent({ type: 'error', message: 'Unable to connect. Check that npm run dev is running.' }); };
  }
  send(type: string, body: Record<string, unknown> = {}): void { if (this.connected && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, ...body })); }
  disconnect(): void { this.ws?.close(); this.ws = null; this.connected = false; this.id = ''; this.code = ''; this.peers.clear(); this.zombie = null; }
}
