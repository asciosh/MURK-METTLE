import { DurableObject } from 'cloudflare:workers';

const MAX_BYTES = 4096;
const KEYS = [
  'murk-mettle-v04-progression', 'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting', 'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
];
function validateSave(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (Object.keys(payload).some(k => !KEYS.includes(k))) return false;
  return Object.values(payload).every(v => v === null || typeof v === 'string' && v.length < 2048);
}
// One SQLite-backed Durable Object per high-entropy recovery key.
// This is a private backup of client saves, NOT authoritative multiplayer progression.
export class PlayerProfile extends DurableObject {
  async fetch(request) {
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
    if (request.method === 'GET') {
      const saved = this.ctx.storage.kv.get('save');
      return Response.json(saved ?? { version: 1, data: null, updatedAt: null }, { headers });
    }
    if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
    const body = await request.text();
    if (body.length > MAX_BYTES) return new Response('Save too large', { status: 413 });
    let data;
    try { data = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }
    if (!validateSave(data)) return new Response('Invalid save format', { status: 400 });
    const saved = { version: 1, data, updatedAt: Date.now() };
    this.ctx.storage.kv.put('save', saved);
    return Response.json({ ok: true, updatedAt: saved.updatedAt }, { headers });
  }
}
