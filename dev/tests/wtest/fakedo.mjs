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
// Storage and explicit alarms; tests invoke object.alarm() themselves without live timers.
export function makeStorage() {
  const data = new Map(); let alarm = null, tail = Promise.resolve();
  const storage = {
    async get(key) { return structuredClone(data.get(key)); },
    async put(key, value) { data.set(key, structuredClone(value)); },
    async list({ prefix = '' } = {}) { return new Map([...data].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)])); },
    async setAlarm(time) { alarm = Number(time); },
    async getAlarm() { return alarm; },
    transaction(fn) {
      const run = tail.then(async () => {
        const saved = structuredClone(data), savedAlarm = alarm;
        try { return await fn(storage); }
        catch (e) { data.clear(); for (const [key, value] of saved) data.set(key, value); alarm = savedAlarm; throw e; }
      });
      tail = run.catch(() => {}); return run;
    },
  };
  return storage;
}
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
          if (!live.has(name)) live.set(name, new Cls({ id: { name, toString: () => name }, storage: makeStorage() }, env));
          const req = input instanceof Request && !init ? input : new Request(input, init);
          return live.get(name).fetch(req);
        },
      };
    },
  };
}
