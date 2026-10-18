// Local stand-ins for Cloudflare's Durable Objects runtime: namespaces with idFromName/get, and WebSocketPair.
// Used by the server tests (pvp.mjs) and by devserver.mjs (which bridges real browser WebSockets onto these).
class FakeWS {
  constructor() { this.peer = null; this.ls = { message: [], close: [], error: [] }; this.readyState = 1; this.accepted = false; this.sent = 0; }
  accept() { this.accepted = true; }
  addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); }
  removeEventListener(t, f) { this.ls[t] = (this.ls[t] || []).filter((x) => x !== f); }
  emit(t, e) { for (const f of this.ls[t] || []) try { f(e); } catch (err) { console.error('ws listener', err); } }
  send(data) {
    if (this.readyState !== 1) throw new Error('socket closed');
    this.sent++;
    const p = this.peer;
    setTimeout(() => { if (p.readyState === 1) p.emit('message', { data }); }, 0);
  }
  close(code = 1000, reason = '') {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    const p = this.peer;
    setTimeout(() => { this.emit('close', { code, reason }); if (p.readyState === 1) { p.readyState = 3; p.emit('close', { code, reason }); } }, 0);
  }
}
export class WebSocketPair {
  constructor() { const a = new FakeWS(), b = new FakeWS(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; }
}
export function installWebSocketPair() { if (!globalThis.WebSocketPair) globalThis.WebSocketPair = WebSocketPair; }
// a Durable Object namespace: one instance per name, requests go straight to its fetch()
export function makeNamespace(Cls, env) {
  const live = new Map();
  return {
    live,
    idFromName: (name) => ({ name: String(name), toString() { return this.name; } }),
    get(id) {
      const name = String(id.name || id);
      return {
        fetch: async (input, init) => {
          if (!live.has(name)) live.set(name, new Cls({ id: { name, toString: () => name }, storage: null }, env));
          const req = input instanceof Request && !init ? input : new Request(input, init);
          return live.get(name).fetch(req);
        },
      };
    },
  };
}
